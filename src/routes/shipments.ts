// Shipment Tracking API — Amberway Equine CRM
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification } from '../lib/db'

const shipments = new Hono<{ Bindings: Bindings }>()

// ── CARRIER TRACKING URL BUILDER ──────────────────────
function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const c = (carrier || '').toLowerCase()
  if (c.includes('ups'))   return `https://www.ups.com/track?tracknum=${trackingNumber}`
  if (c.includes('fedex')) return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`
  if (c.includes('usps'))  return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`
  if (c.includes('estes')) return `https://www.estes-express.com/myestes/shipment-tracking/?search=${trackingNumber}`
  if (c.includes('xpo'))   return `https://track.xpo.com/tracking?number=${trackingNumber}`
  if (c.includes('r+l') || c.includes('r&l') || c.includes('rl'))
    return `https://www.rlcarriers.com/freight/shipping/shipment-tracing?pro=${trackingNumber}`
  if (c.includes('old dominion') || c.includes('odfl'))
    return `https://www.odfl.com/us/en/tools/tracking.html?pro=${trackingNumber}`
  return `https://www.google.com/search?q=${encodeURIComponent(carrier)}+tracking+${trackingNumber}`
}

// ── GET /api/shipments — list active shipments ─────────
shipments.get('/', async (c) => {
  const { DB } = c.env
  const status    = c.req.query('status')
  const deal_id   = c.req.query('deal_id')
  const contact_id = c.req.query('contact_id')
  const active    = c.req.query('active') // 'true' = exclude delivered/failed
  const limit     = parseInt(c.req.query('limit') || '50')

  let query = `
    SELECT sh.*,
      co.first_name || ' ' || co.last_name AS contact_name,
      co.email AS contact_email,
      co.mobile AS contact_phone,
      d.title AS deal_title,
      po.po_number
    FROM shipments sh
    LEFT JOIN contacts co ON sh.contact_id = co.id
    LEFT JOIN deals d ON sh.deal_id = d.id
    LEFT JOIN purchase_orders po ON sh.purchase_order_id = po.id
    WHERE 1=1
  `
  const params: any[] = []

  if (status)     { query += ' AND sh.status = ?';     params.push(status) }
  if (deal_id)    { query += ' AND sh.deal_id = ?';    params.push(deal_id) }
  if (contact_id) { query += ' AND sh.contact_id = ?'; params.push(contact_id) }
  if (active === 'true') {
    query += ` AND sh.status NOT IN ('delivered','failed','returned','cancelled')`
  }

  query += ' ORDER BY sh.created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ shipments: results, count: results.length })
})

// ── GET /api/shipments/:id — shipment detail ───────────
shipments.get('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  const shipment = await DB.prepare(`
    SELECT sh.*,
      co.first_name || ' ' || co.last_name AS contact_name,
      co.email AS contact_email,
      co.mobile AS contact_phone,
      d.title AS deal_title,
      po.po_number, po.line_items AS po_line_items
    FROM shipments sh
    LEFT JOIN contacts co ON sh.contact_id = co.id
    LEFT JOIN deals d ON sh.deal_id = d.id
    LEFT JOIN purchase_orders po ON sh.purchase_order_id = po.id
    WHERE sh.id = ?
  `).bind(id).first() as any

  if (!shipment) return c.json({ error: 'Shipment not found' }, 404)

  // Parse tracking history
  let history: any[] = []
  try { history = JSON.parse(shipment.tracking_history || '[]') } catch {}

  return c.json({ shipment: { ...shipment, tracking_history: history } })
})

// ── POST /api/shipments — create shipment (with tracking) ─
shipments.post('/', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  const {
    purchase_order_id,
    deal_id,
    contact_id,
    carrier,
    tracking_number,
    tracking_url: customUrl,
    estimated_delivery,
    notes
  } = body

  if (!carrier || !tracking_number) {
    return c.json({ error: 'carrier and tracking_number are required' }, 400)
  }

  const tracking_url = customUrl || getTrackingUrl(carrier, tracking_number)

  const result = await DB.prepare(`
    INSERT INTO shipments (purchase_order_id, deal_id, contact_id, carrier, tracking_number,
      tracking_url, status, estimated_delivery, customer_notified,
      tracking_history, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'in_transit', ?, 0,
      json_array(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    purchase_order_id || null, deal_id || null, contact_id || null,
    carrier, tracking_number, tracking_url,
    estimated_delivery || null
  ).run()

  const shipmentId = result.meta.last_row_id as number

  // Add initial tracking event
  const initialEvent = {
    timestamp: new Date().toISOString(),
    status: 'in_transit',
    description: `Shipment created — ${carrier} tracking #${tracking_number}`,
    location: ''
  }
  await DB.prepare(`
    UPDATE shipments SET tracking_history = json_array(json(?)) WHERE id = ?
  `).bind(JSON.stringify(initialEvent), shipmentId).run()

  // Update deal stage to 'shipping' if deal_id given
  if (deal_id) {
    await DB.prepare(`UPDATE deals SET stage='shipping', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(deal_id).run()
  }

  // Log activity
  await logActivity(DB, {
    deal_id: deal_id || null,
    entity_type: 'shipment',
    entity_id: shipmentId,
    action: 'created',
    description: `Shipment created: ${carrier} ${tracking_number}`,
    performed_by: 'user'
  })

  // Create notification
  await createNotification(DB, {
    type: 'shipment_update',
    title: `📦 Tracking added — ${carrier}`,
    message: `${tracking_number} · Deal moving to In Transit`,
    entity_type: 'shipment',
    entity_id: shipmentId,
    priority: 'high',
    action_url: `/shipments/${shipmentId}`
  })

  const newShipment = await DB.prepare('SELECT * FROM shipments WHERE id = ?').bind(shipmentId).first()
  return c.json({ shipment: newShipment, tracking_url }, 201)
})

// ── PATCH /api/shipments/:id/status — update status ───
shipments.patch('/:id/status', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  const { status, location, description, actual_delivery } = body

  const validStatuses = ['pending','label_created','picked_up','in_transit',
    'out_for_delivery','delivered','failed','returned','cancelled']
  if (!validStatuses.includes(status)) {
    return c.json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` }, 400)
  }

  const existing = await DB.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Shipment not found' }, 404)

  // Build new tracking history event
  let history: any[] = []
  try { history = JSON.parse(existing.tracking_history || '[]') } catch {}

  const event = {
    timestamp: new Date().toISOString(),
    status,
    description: description || statusLabel(status),
    location: location || ''
  }
  history.unshift(event) // newest first

  const isDelivered = status === 'delivered'
  const deliveryDate = isDelivered ? (actual_delivery || new Date().toISOString().split('T')[0]) : existing.actual_delivery

  await DB.prepare(`
    UPDATE shipments SET
      status = ?,
      last_status = ?,
      last_checked_at = CURRENT_TIMESTAMP,
      current_location = ?,
      tracking_history = ?,
      actual_delivery = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    status, status,
    location || existing.current_location,
    JSON.stringify(history),
    deliveryDate,
    id
  ).run()

  // ── DELIVERED: update deal, create follow-up task & notification ──
  if (isDelivered && existing.deal_id) {
    // Move deal to delivered stage
    await DB.prepare(`UPDATE deals SET stage='delivered', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(existing.deal_id).run()

    // Get contact name for task title
    const contact = existing.contact_id
      ? await DB.prepare(`SELECT first_name, last_name FROM contacts WHERE id=?`).bind(existing.contact_id).first() as any
      : null
    const cname = contact ? `${contact.first_name} ${contact.last_name}` : 'customer'

    // Create follow-up task: confirm delivery
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const taskDate = tomorrow.toISOString().split('T')[0]

    await DB.prepare(`
      INSERT INTO tasks (deal_id, contact_id, title, description, type, priority, status, due_date, ai_generated, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'follow_up', 'high', 'pending', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      existing.deal_id, existing.contact_id || null,
      `✅ Confirm delivery with ${cname}`,
      `Order delivered via ${existing.carrier}. Confirm customer received everything in good condition and is satisfied.`,
      taskDate
    ).run()

    // Create follow-up task: request review/referral (3 days out)
    const threeDays = new Date(); threeDays.setDate(threeDays.getDate() + 3)
    const reviewDate = threeDays.toISOString().split('T')[0]

    await DB.prepare(`
      INSERT INTO tasks (deal_id, contact_id, title, description, type, priority, status, due_date, ai_generated, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'follow_up', 'medium', 'pending', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      existing.deal_id, existing.contact_id || null,
      `⭐ Request review & referral from ${cname}`,
      `Ask ${cname} to leave a Google review and mention Amberway Equine to any friends with equine needs.`,
      reviewDate
    ).run()

    // Notify
    await createNotification(DB, {
      type: 'shipment_update',
      title: `🎉 Delivered! Follow up with ${cname}`,
      message: `${existing.carrier} ${existing.tracking_number} — 2 follow-up tasks created`,
      entity_type: 'shipment',
      entity_id: parseInt(id),
      priority: 'high',
      action_url: `/deals/${existing.deal_id}`
    })

    // Update PO status to received
    if (existing.purchase_order_id) {
      await DB.prepare(`
        UPDATE purchase_orders SET status='received', received_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).bind(existing.purchase_order_id).run()
    }
  }

  // Log activity
  await logActivity(DB, {
    deal_id: existing.deal_id,
    entity_type: 'shipment',
    entity_id: parseInt(id),
    action: 'status_updated',
    description: `Shipment ${isDelivered ? 'DELIVERED' : status.replace(/_/g,' ')}: ${existing.carrier} ${existing.tracking_number}`,
    old_value: existing.status,
    new_value: status,
    performed_by: 'system'
  })

  const updated = await DB.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first() as any
  let updatedHistory: any[] = []
  try { updatedHistory = JSON.parse(updated.tracking_history || '[]') } catch {}

  return c.json({
    success: true,
    shipment: { ...updated, tracking_history: updatedHistory },
    tasks_created: isDelivered ? 2 : 0
  })
})

// ── PATCH /api/shipments/:id/notify-customer — mark notified ──
shipments.patch('/:id/notify-customer', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  const existing = await DB.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Shipment not found' }, 404)

  await DB.prepare(`
    UPDATE shipments SET customer_notified=1, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(id).run()

  await logActivity(DB, {
    deal_id: existing.deal_id,
    entity_type: 'shipment',
    entity_id: parseInt(id),
    action: 'customer_notified',
    description: `Customer notified of tracking: ${existing.carrier} ${existing.tracking_number}`,
    performed_by: 'user'
  })

  // Log communication
  if (existing.deal_id && existing.contact_id) {
    await DB.prepare(`
      INSERT INTO communications (deal_id, contact_id, type, direction, subject, body, status, sent_at)
      VALUES (?, ?, 'email', 'outbound', ?, ?, 'sent', CURRENT_TIMESTAMP)
    `).bind(
      existing.deal_id, existing.contact_id,
      `Your order is on its way — ${existing.carrier} tracking #${existing.tracking_number}`,
      `Tracking shared with customer. Carrier: ${existing.carrier}, Tracking #: ${existing.tracking_number}, URL: ${existing.tracking_url}`
    ).run()
  }

  return c.json({ success: true, customer_notified: true })
})

// ── POST /api/shipments/:id/add-event — add tracking history event ──
shipments.post('/:id/add-event', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { status, description, location } = await c.req.json()

  const existing = await DB.prepare('SELECT * FROM shipments WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Shipment not found' }, 404)

  let history: any[] = []
  try { history = JSON.parse(existing.tracking_history || '[]') } catch {}

  history.unshift({
    timestamp: new Date().toISOString(),
    status: status || existing.status,
    description: description || '',
    location: location || ''
  })

  await DB.prepare(`
    UPDATE shipments SET tracking_history=?, last_status=?, current_location=?, last_checked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(JSON.stringify(history), status || existing.status, location || existing.current_location, id).run()

  return c.json({ success: true, history })
})

// ── GET /api/shipments/active/summary — for Today screen ──
shipments.get('/active/summary', async (c) => {
  const { DB } = c.env

  const { results } = await DB.prepare(`
    SELECT sh.id, sh.carrier, sh.tracking_number, sh.tracking_url,
      sh.status, sh.estimated_delivery, sh.actual_delivery,
      sh.customer_notified, sh.current_location, sh.last_checked_at,
      co.first_name || ' ' || co.last_name AS contact_name,
      d.title AS deal_title, d.id AS deal_id,
      po.po_number
    FROM shipments sh
    LEFT JOIN contacts co ON sh.contact_id = co.id
    LEFT JOIN deals d ON sh.deal_id = d.id
    LEFT JOIN purchase_orders po ON sh.purchase_order_id = po.id
    WHERE sh.status NOT IN ('delivered','failed','returned','cancelled')
    ORDER BY sh.created_at DESC
    LIMIT 20
  `).all()

  return c.json({ active_shipments: results, count: results.length })
})

// ── Helper ─────────────────────────────────────────────
function statusLabel(s: string): string {
  const labels: Record<string, string> = {
    pending: 'Label created',
    label_created: 'Label created, awaiting pickup',
    picked_up: 'Package picked up by carrier',
    in_transit: 'In transit to destination',
    out_for_delivery: 'Out for delivery today',
    delivered: 'Package delivered',
    failed: 'Delivery attempt failed',
    returned: 'Package returned to sender',
    cancelled: 'Shipment cancelled'
  }
  return labels[s] || s
}

export default shipments
