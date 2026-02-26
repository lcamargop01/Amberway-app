// Deals / Pipeline API routes
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification } from '../lib/db'

const deals = new Hono<{ Bindings: Bindings }>()

// GET /api/deals - List deals with filters
deals.get('/', async (c) => {
  const { DB } = c.env
  const stage = c.req.query('stage') || ''
  const status = c.req.query('status') || 'active'
  const search = c.req.query('search') || ''
  const limit = parseInt(c.req.query('limit') || '100')
  const offset = parseInt(c.req.query('offset') || '0')

  let query = `
    SELECT d.*, 
      c.first_name || ' ' || c.last_name as contact_name,
      co.name as company_name
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    WHERE 1=1
  `
  const params: any[] = []

  if (status && status !== 'all') {
    query += ` AND d.status = ?`; params.push(status)
  }
  if (stage) {
    query += ` AND d.stage = ?`; params.push(stage)
  }
  if (search) {
    query += ` AND (d.title LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR co.name LIKE ?)`
    const s = `%${search}%`
    params.push(s, s, s, s)
  }
  query += ` ORDER BY d.updated_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const { results } = await DB.prepare(query).bind(...params).all()
  
  // Get pipeline stats
  const { results: stageStats } = await DB.prepare(`
    SELECT stage, COUNT(*) as count, SUM(value) as total_value
    FROM deals WHERE status = 'active'
    GROUP BY stage
  `).all()
  
  return c.json({ deals: results, stage_stats: stageStats })
})

// GET /api/deals/pipeline - Kanban view data
deals.get('/pipeline', async (c) => {
  const { DB } = c.env
  
  const { results } = await DB.prepare(`
    SELECT d.*, 
      c.first_name || ' ' || c.last_name as contact_name,
      co.name as company_name
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    WHERE d.status = 'active'
    ORDER BY d.priority DESC, d.updated_at DESC
  `).all()
  
  // Group by stage
  const stages = ['lead','qualified','proposal_sent','estimate_sent','estimate_accepted',
                  'invoice_sent','invoice_paid','order_placed','order_confirmed','shipping','delivered']
  const pipeline: Record<string, any[]> = {}
  stages.forEach(s => pipeline[s] = [])
  
  results.forEach((deal: any) => {
    if (pipeline[deal.stage]) {
      pipeline[deal.stage].push(deal)
    }
  })
  
  return c.json({ pipeline, stages })
})

// GET /api/deals/:id
deals.get('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const deal = await DB.prepare(`
    SELECT d.*, 
      c.first_name || ' ' || c.last_name as contact_name,
      c.email as contact_email, c.phone as contact_phone, c.mobile as contact_mobile,
      co.name as company_name
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    WHERE d.id = ?
  `).bind(id).first()
  
  if (!deal) return c.json({ error: 'Deal not found' }, 404)
  
  const { results: communications } = await DB.prepare(`
    SELECT * FROM communications WHERE deal_id = ? ORDER BY created_at DESC LIMIT 20
  `).bind(id).all()
  
  const { results: tasks } = await DB.prepare(`
    SELECT * FROM tasks WHERE deal_id = ? ORDER BY due_date ASC
  `).bind(id).all()
  
  const { results: estimates } = await DB.prepare(`
    SELECT * FROM estimates WHERE deal_id = ? ORDER BY created_at DESC
  `).bind(id).all()
  
  const { results: invoices } = await DB.prepare(`
    SELECT * FROM invoices WHERE deal_id = ? ORDER BY created_at DESC
  `).bind(id).all()
  
  const { results: purchase_orders } = await DB.prepare(`
    SELECT po.*, s.name as supplier_name FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.deal_id = ? ORDER BY po.created_at DESC
  `).bind(id).all()
  
  const { results: shipments } = await DB.prepare(`
    SELECT * FROM shipments WHERE deal_id = ? ORDER BY created_at DESC
  `).bind(id).all()
  
  const { results: activity } = await DB.prepare(`
    SELECT * FROM activity_log WHERE deal_id = ? ORDER BY created_at DESC LIMIT 30
  `).bind(id).all()
  
  return c.json({ deal, communications, tasks, estimates, invoices, purchase_orders, shipments, activity })
})

// POST /api/deals
deals.post('/', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO deals (title, contact_id, company_id, stage, status, priority, value, probability,
                       product_categories, notes, expected_close_date, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.title,
    body.contact_id || null,
    body.company_id || null,
    body.stage || 'lead',
    body.status || 'active',
    body.priority || 'medium',
    body.value || 0,
    body.probability || 50,
    JSON.stringify(body.product_categories || []),
    body.notes || null,
    body.expected_close_date || null,
    body.source || null
  ).run()
  
  const dealId = result.meta.last_row_id as number
  const newDeal = await DB.prepare('SELECT * FROM deals WHERE id = ?').bind(dealId).first()
  
  await logActivity(DB, {
    deal_id: dealId,
    contact_id: body.contact_id,
    entity_type: 'deal',
    entity_id: dealId,
    action: 'created',
    description: `Deal "${body.title}" created in stage: ${body.stage || 'lead'}`,
    performed_by: 'user'
  })
  
  // Auto-create welcome task
  await DB.prepare(`
    INSERT INTO tasks (deal_id, contact_id, title, type, priority, due_date, ai_generated)
    VALUES (?, ?, ?, ?, ?, datetime('now', '+1 day'), 1)
  `).bind(dealId, body.contact_id || null, 'Follow up with new lead', 'follow_up', 'high').run()
  
  return c.json({ deal: newDeal }, 201)
})

// PUT /api/deals/:id
deals.put('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  const existing = await DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Deal not found' }, 404)
  
  await DB.prepare(`
    UPDATE deals SET title=?, contact_id=?, company_id=?, stage=?, status=?, priority=?, value=?,
      probability=?, product_categories=?, notes=?, expected_close_date=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    body.title, body.contact_id || null, body.company_id || null, body.stage || existing.stage,
    body.status || existing.status, body.priority || existing.priority, body.value ?? existing.value,
    body.probability ?? existing.probability, JSON.stringify(body.product_categories || JSON.parse(existing.product_categories || '[]')),
    body.notes || existing.notes, body.expected_close_date || existing.expected_close_date, id
  ).run()
  
  // Log stage change
  if (body.stage && body.stage !== existing.stage) {
    await logActivity(DB, {
      deal_id: parseInt(id),
      entity_type: 'deal',
      entity_id: parseInt(id),
      action: 'stage_changed',
      description: `Stage changed from "${existing.stage}" to "${body.stage}"`,
      old_value: existing.stage,
      new_value: body.stage,
      performed_by: 'user'
    })
    await createNotification(DB, {
      type: 'deal_update',
      title: `Deal stage updated: ${body.title || existing.title}`,
      message: `Moved from ${existing.stage} → ${body.stage}`,
      entity_type: 'deal',
      entity_id: parseInt(id),
      action_url: `/deals/${id}`
    })
  }
  
  const updated = await DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first()
  return c.json({ deal: updated })
})

// PATCH /api/deals/:id/stage - Quick stage update
deals.patch('/:id/stage', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { stage } = await c.req.json()
  
  const existing = await DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first() as any
  if (!existing) return c.json({ error: 'Deal not found' }, 404)
  
  await DB.prepare(`UPDATE deals SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(stage, id).run()
  
  await logActivity(DB, {
    deal_id: parseInt(id),
    entity_type: 'deal',
    entity_id: parseInt(id),
    action: 'stage_changed',
    description: `Stage updated to "${stage}"`,
    old_value: existing.stage,
    new_value: stage,
    performed_by: 'user'
  })
  
  return c.json({ success: true, stage })
})

// DELETE /api/deals/:id
deals.delete('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('UPDATE deals SET status=? WHERE id=?').bind('archived', id).run()
  return c.json({ success: true })
})

// GET /api/deals/:id/summary - AI summary
deals.get('/:id/summary', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const deal = await DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first() as any
  const { results: comms } = await DB.prepare(`
    SELECT type, direction, subject, summary, created_at FROM communications 
    WHERE deal_id = ? ORDER BY created_at DESC LIMIT 10
  `).bind(id).all()
  
  return c.json({
    deal,
    recent_communications: comms,
    ai_summary: deal?.ai_status_summary || 'No AI analysis yet.',
    ai_next_action: deal?.ai_next_action || 'Schedule initial contact.'
  })
})

export default deals
