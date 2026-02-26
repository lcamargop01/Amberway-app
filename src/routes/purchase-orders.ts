// Purchase Orders & Supplier Management API
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification, generatePONumber } from '../lib/db'

const purchaseOrders = new Hono<{ Bindings: Bindings }>()

// GET /api/purchase-orders
purchaseOrders.get('/', async (c) => {
  const { DB } = c.env
  const deal_id = c.req.query('deal_id')
  const supplier_id = c.req.query('supplier_id')
  const status = c.req.query('status')
  const limit = parseInt(c.req.query('limit') || '50')

  let query = `
    SELECT po.*, s.name as supplier_name, s.email as supplier_email,
      d.title as deal_title,
      co.first_name || ' ' || co.last_name as contact_name
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN deals d ON po.deal_id = d.id
    LEFT JOIN contacts co ON d.contact_id = co.id
    WHERE 1=1
  `
  const params: any[] = []
  if (deal_id) { query += ' AND po.deal_id = ?'; params.push(deal_id) }
  if (supplier_id) { query += ' AND po.supplier_id = ?'; params.push(supplier_id) }
  if (status) { query += ' AND po.status = ?'; params.push(status) }
  query += ' ORDER BY po.created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ purchase_orders: results })
})

// GET /api/purchase-orders/:id
purchaseOrders.get('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  const po = await DB.prepare(`
    SELECT po.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
      d.title as deal_title
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN deals d ON po.deal_id = d.id
    WHERE po.id = ?
  `).bind(id).first()

  if (!po) return c.json({ error: 'PO not found' }, 404)

  const { results: shipments } = await DB.prepare(`
    SELECT * FROM shipments WHERE purchase_order_id = ?
  `).bind(id).all()

  return c.json({ purchase_order: po, shipments })
})

// POST /api/purchase-orders
purchaseOrders.post('/', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  const poNumber = generatePONumber()
  const result = await DB.prepare(`
    INSERT INTO purchase_orders (deal_id, invoice_id, supplier_id, po_number, status, line_items,
      subtotal, tax_amount, shipping_amount, total, notes, expected_delivery)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.deal_id || null, body.invoice_id || null, body.supplier_id || null,
    poNumber, body.status || 'draft',
    JSON.stringify(body.line_items || []),
    body.subtotal || 0, body.tax_amount || 0, body.shipping_amount || 0, body.total || 0,
    body.notes || null, body.expected_delivery || null
  ).run()

  const poId = result.meta.last_row_id as number
  
  await logActivity(DB, {
    deal_id: body.deal_id,
    entity_type: 'purchase_order',
    entity_id: poId,
    action: 'created',
    description: `Purchase Order ${poNumber} created`,
    performed_by: 'user'
  })

  const newPO = await DB.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(poId).first()
  return c.json({ purchase_order: newPO, po_number: poNumber }, 201)
})

// PUT /api/purchase-orders/:id
purchaseOrders.put('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await DB.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'PO not found' }, 404)

  await DB.prepare(`
    UPDATE purchase_orders SET supplier_id=?, status=?, line_items=?, subtotal=?, tax_amount=?,
      shipping_amount=?, total=?, notes=?, supplier_notes=?, expected_delivery=?,
      supplier_order_number=?, tracking_numbers=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    body.supplier_id || existing.supplier_id,
    body.status || existing.status,
    JSON.stringify(body.line_items || JSON.parse(existing.line_items || '[]')),
    body.subtotal ?? existing.subtotal, body.tax_amount ?? existing.tax_amount,
    body.shipping_amount ?? existing.shipping_amount, body.total ?? existing.total,
    body.notes || existing.notes, body.supplier_notes || existing.supplier_notes,
    body.expected_delivery || existing.expected_delivery,
    body.supplier_order_number || existing.supplier_order_number,
    JSON.stringify(body.tracking_numbers || JSON.parse(existing.tracking_numbers || '[]')),
    id
  ).run()

  // Handle status transitions
  if (body.status && body.status !== existing.status) {
    const statusField: Record<string, string> = {
      'quote_requested': 'quote_requested_at',
      'quote_received': 'quote_received_at',
      'approved': 'approved_at',
      'submitted': 'submitted_at',
      'confirmed': 'confirmed_at',
      'shipped': 'shipped_at',
      'received': 'received_at'
    }
    
    if (statusField[body.status]) {
      await DB.prepare(`UPDATE purchase_orders SET ${statusField[body.status]}=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run()
    }
    
    // Update deal stage when PO status changes
    if (existing.deal_id) {
      const dealStageMap: Record<string, string> = {
        submitted: 'order_placed',
        confirmed: 'order_confirmed',
        shipped: 'shipping',
        received: 'delivered'
      }
      if (dealStageMap[body.status]) {
        await DB.prepare('UPDATE deals SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .bind(dealStageMap[body.status], existing.deal_id).run()
      }
    }

    await logActivity(DB, {
      deal_id: existing.deal_id,
      entity_type: 'purchase_order',
      entity_id: parseInt(id),
      action: 'status_changed',
      description: `PO ${existing.po_number} status: ${existing.status} → ${body.status}`,
      old_value: existing.status,
      new_value: body.status,
      performed_by: 'user'
    })
  }

  const updated = await DB.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first()
  return c.json({ purchase_order: updated })
})

// POST /api/purchase-orders/:id/request-quote - Send quote request to supplier
purchaseOrders.post('/:id/request-quote', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  const po = await DB.prepare(`
    SELECT po.*, s.name as supplier_name, s.email as supplier_email,
      d.title as deal_title
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN deals d ON po.deal_id = d.id
    WHERE po.id = ?
  `).bind(id).first() as any

  if (!po) return c.json({ error: 'PO not found' }, 404)

  // Get line items
  const lineItems = JSON.parse(po.line_items || '[]')
  const lineItemsText = lineItems.map((item: any) => 
    `- ${item.description || item.name} (Qty: ${item.quantity}, SKU: ${item.sku || 'N/A'})`
  ).join('\n')

  // Build quote request email
  const emailSubject = `Quote Request - ${po.deal_title || 'Equine Project'} - ${po.po_number}`
  const emailBody = `
    <p>Hello ${po.supplier_name},</p>
    <p>We would like to request a quote for the following items for one of our customer projects.</p>
    <p><strong>Purchase Order:</strong> ${po.po_number}<br>
    <strong>Project:</strong> ${po.deal_title || 'Customer Project'}</p>
    <p><strong>Items Requested:</strong></p>
    <pre>${lineItemsText || 'See attached specifications'}</pre>
    <p>Please provide pricing, availability, and estimated lead times at your earliest convenience.</p>
    <p>Thank you,<br>
    Amberway Equine LLC<br>
    info@amberwayequine.com</p>
  `

  // Log communication
  await DB.prepare(`
    INSERT INTO communications (deal_id, type, direction, subject, body, status, to_address, sent_at)
    VALUES (?, 'email', 'outbound', ?, ?, 'sent', ?, CURRENT_TIMESTAMP)
  `).bind(po.deal_id, emailSubject, emailBody, po.supplier_email).run()

  // Update PO status
  await DB.prepare(`
    UPDATE purchase_orders SET status='quote_requested', quote_requested_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(id).run()

  await createNotification(DB, {
    type: 'quote_requested',
    title: `Quote requested from ${po.supplier_name}`,
    message: `PO ${po.po_number} - Quote request sent`,
    entity_type: 'purchase_order',
    entity_id: parseInt(id),
    action_url: `/purchase-orders/${id}`
  })

  return c.json({ 
    success: true, 
    message: `Quote request prepared for ${po.supplier_name}`,
    email_subject: emailSubject,
    supplier_email: po.supplier_email
  })
})

// POST /api/purchase-orders/:id/add-tracking
purchaseOrders.post('/:id/add-tracking', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { carrier, tracking_number, contact_id } = await c.req.json()

  const po = await DB.prepare('SELECT * FROM purchase_orders WHERE id = ?').bind(id).first() as any
  if (!po) return c.json({ error: 'PO not found' }, 404)

  // Add tracking to PO
  const existing_tracking = JSON.parse(po.tracking_numbers || '[]')
  existing_tracking.push(tracking_number)
  
  await DB.prepare(`
    UPDATE purchase_orders SET tracking_numbers=?, status='shipped', shipped_at=CURRENT_TIMESTAMP, 
      shipping_carrier=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(JSON.stringify(existing_tracking), carrier, id).run()

  // Create shipment record
  const trackingUrl = getTrackingUrl(carrier, tracking_number)
  const shipResult = await DB.prepare(`
    INSERT INTO shipments (purchase_order_id, deal_id, contact_id, carrier, tracking_number, tracking_url, status)
    VALUES (?, ?, ?, ?, ?, ?, 'in_transit')
  `).bind(parseInt(id), po.deal_id, contact_id || null, carrier, tracking_number, trackingUrl).run()

  // Update deal stage to shipping
  if (po.deal_id) {
    await DB.prepare('UPDATE deals SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind('shipping', po.deal_id).run()
    
    // Create notification
    await createNotification(DB, {
      type: 'shipment_update',
      title: `Order shipped! Tracking: ${tracking_number}`,
      message: `Carrier: ${carrier}`,
      entity_type: 'purchase_order',
      entity_id: parseInt(id),
      priority: 'high',
      action_url: `/purchase-orders/${id}`
    })
  }

  return c.json({ 
    success: true, 
    tracking_url: trackingUrl,
    shipment_id: shipResult.meta.last_row_id
  })
})

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const c = carrier?.toLowerCase() || ''
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${trackingNumber}`
  if (c.includes('fedex')) return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingNumber}`
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`
  if (c.includes('estes')) return `https://www.estes-express.com/myestes/shipment-tracking/?search=${trackingNumber}`
  if (c.includes('xpo')) return `https://track.xpo.com/tracking?number=${trackingNumber}`
  return `https://www.google.com/search?q=${carrier}+tracking+${trackingNumber}`
}

// GET /api/suppliers
purchaseOrders.get('/suppliers/list', async (c) => {
  const { DB } = c.env
  const { results } = await DB.prepare('SELECT * FROM suppliers WHERE active=1 ORDER BY name').all()
  return c.json({ suppliers: results })
})

export default purchaseOrders
