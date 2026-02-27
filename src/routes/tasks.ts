// Tasks & Reminders API
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification } from '../lib/db'

const tasks = new Hono<{ Bindings: Bindings }>()

// GET /api/tasks
tasks.get('/', async (c) => {
  const { DB } = c.env
  const status = c.req.query('status') || 'pending'
  const deal_id = c.req.query('deal_id')
  const contact_id = c.req.query('contact_id')
  const overdue = c.req.query('overdue')
  const search = c.req.query('search') || ''
  const priority = c.req.query('priority') || ''
  const due_filter = c.req.query('due') || ''   // 'overdue' | 'today' | 'week'
  const limit = parseInt(c.req.query('limit') || '200')

  let query = `
    SELECT t.*, d.title as deal_title, 
      c.first_name || ' ' || c.last_name as contact_name
    FROM tasks t
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE 1=1
  `
  const params: any[] = []

  if (status !== 'all') { query += ' AND t.status = ?'; params.push(status) }
  if (deal_id) { query += ' AND t.deal_id = ?'; params.push(deal_id) }
  if (contact_id) { query += ' AND t.contact_id = ?'; params.push(contact_id) }
  if (overdue === 'true') { query += " AND t.due_date < datetime('now') AND t.status != 'completed'" }
  if (search) {
    query += " AND (t.title LIKE ? OR d.title LIKE ? OR (c.first_name || ' ' || c.last_name) LIKE ?)"
    const like = `%${search}%`
    params.push(like, like, like)
  }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority) }
  if (due_filter === 'overdue') {
    query += " AND t.due_date < date('now') AND t.status != 'completed'"
  } else if (due_filter === 'today') {
    query += " AND date(t.due_date) = date('now')"
  } else if (due_filter === 'week') {
    query += " AND date(t.due_date) <= date('now', '+7 days') AND t.status != 'completed'"
  }

  query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, t.due_date ASC LIMIT ?'
  params.push(limit)

  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ tasks: results, total: results.length })
})

// GET /api/tasks/due-today
tasks.get('/due-today', async (c) => {
  const { DB } = c.env
  const { results } = await DB.prepare(`
    SELECT t.*, d.title as deal_title,
      c.first_name || ' ' || c.last_name as contact_name
    FROM tasks t
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE t.status IN ('pending', 'in_progress')
      AND date(t.due_date) <= date('now')
    ORDER BY t.priority DESC, t.due_date ASC
    LIMIT 20
  `).all()
  return c.json({ tasks: results })
})

// POST /api/tasks
tasks.post('/', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  const result = await DB.prepare(`
    INSERT INTO tasks (deal_id, contact_id, title, description, type, priority, status, assigned_to, due_date, ai_generated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.deal_id || null, body.contact_id || null, body.title, body.description || null,
    body.type || 'follow_up', body.priority || 'medium', body.status || 'pending',
    body.assigned_to || 'team', body.due_date || null, body.ai_generated ? 1 : 0
  ).run()

  return c.json({ task: { id: result.meta.last_row_id, ...body } }, 201)
})

// PUT /api/tasks/:id
tasks.put('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()

  await DB.prepare(`
    UPDATE tasks SET title=?, description=?, type=?, priority=?, status=?, assigned_to=?, due_date=?, 
      notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    body.title, body.description || null, body.type || 'follow_up', body.priority || 'medium',
    body.status || 'pending', body.assigned_to || 'team', body.due_date || null, body.notes || null, id
  ).run()

  return c.json({ success: true })
})

// PATCH /api/tasks/:id/complete
tasks.patch('/:id/complete', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  await DB.prepare(`
    UPDATE tasks SET status='completed', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(id).run()

  return c.json({ success: true })
})

// PATCH /api/tasks/:id/snooze
tasks.patch('/:id/snooze', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { days } = await c.req.json()
  const snoozeUntil = new Date()
  snoozeUntil.setDate(snoozeUntil.getDate() + (days || 1))

  await DB.prepare(`
    UPDATE tasks SET status='snoozed', snoozed_until=?, due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(snoozeUntil.toISOString(), snoozeUntil.toISOString(), id).run()

  return c.json({ success: true, snoozed_until: snoozeUntil.toISOString() })
})

// DELETE /api/tasks/:id
tasks.delete('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// POST /api/tasks/generate - AI-generate tasks for a deal
tasks.post('/generate', async (c) => {
  const { DB } = c.env
  const { deal_id } = await c.req.json()

  const deal = await DB.prepare(`
    SELECT d.*, c.first_name || ' ' || c.last_name as contact_name
    FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?
  `).bind(deal_id).first() as any

  if (!deal) return c.json({ error: 'Deal not found' }, 404)

  // Generate smart tasks based on stage
  const stageTasks: Record<string, Array<{title: string, type: string, days: number, priority: string}>> = {
    lead: [
      { title: `Research ${deal.contact_name || 'prospect'}'s facility needs`, type: 'follow_up', days: 0, priority: 'high' },
      { title: `Initial contact call with ${deal.contact_name || 'prospect'}`, type: 'call', days: 1, priority: 'high' },
    ],
    qualified: [
      { title: 'Send product catalog and pricing overview', type: 'email', days: 1, priority: 'high' },
      { title: 'Schedule design consultation', type: 'meeting', days: 3, priority: 'high' },
    ],
    proposal_sent: [
      { title: 'Follow up on proposal', type: 'follow_up', days: 3, priority: 'high' },
      { title: 'Second follow up if no response', type: 'email', days: 7, priority: 'medium' },
    ],
    estimate_sent: [
      { title: 'Follow up on estimate acceptance', type: 'call', days: 2, priority: 'high' },
      { title: 'Confirm all items and pricing', type: 'follow_up', days: 5, priority: 'medium' },
    ],
    estimate_accepted: [
      { title: 'Send invoice via QuickBooks', type: 'email', days: 0, priority: 'urgent' },
    ],
    invoice_sent: [
      { title: 'Confirm invoice received', type: 'follow_up', days: 2, priority: 'high' },
      { title: 'Follow up on payment', type: 'call', days: 7, priority: 'high' },
    ],
    invoice_paid: [
      { title: 'Place order with supplier(s)', type: 'order_check', days: 0, priority: 'urgent' },
      { title: 'Request quotes from suppliers', type: 'quote_request', days: 0, priority: 'urgent' },
    ],
    order_placed: [
      { title: 'Confirm order with supplier', type: 'order_check', days: 1, priority: 'high' },
      { title: 'Get tracking/shipping info', type: 'delivery_check', days: 3, priority: 'medium' },
    ],
    order_confirmed: [
      { title: 'Get updated ETA from supplier', type: 'order_check', days: 7, priority: 'medium' },
    ],
    shipping: [
      { title: 'Send tracking info to customer', type: 'email', days: 0, priority: 'high' },
      { title: 'Confirm delivery date', type: 'delivery_check', days: 2, priority: 'medium' },
    ],
    delivered: [
      { title: 'Confirm delivery with customer', type: 'call', days: 0, priority: 'high' },
      { title: 'Request review/referral', type: 'email', days: 3, priority: 'low' },
    ]
  }

  const stageTaskDefs = stageTasks[deal.stage] || [
    { title: `Follow up with ${deal.contact_name || 'customer'}`, type: 'follow_up', days: 2, priority: 'medium' }
  ]

  const created = []
  for (const taskDef of stageTaskDefs) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + taskDef.days)
    
    // Check if similar task exists
    const existing = await DB.prepare(`
      SELECT id FROM tasks WHERE deal_id = ? AND title = ? AND status != 'completed'
    `).bind(deal_id, taskDef.title).first()
    
    if (!existing) {
      const r = await DB.prepare(`
        INSERT INTO tasks (deal_id, contact_id, title, type, priority, status, due_date, ai_generated)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, 1)
      `).bind(deal_id, deal.contact_id, taskDef.title, taskDef.type, taskDef.priority, dueDate.toISOString()).run()
      created.push({ id: r.meta.last_row_id, ...taskDef })
    }
  }

  return c.json({ success: true, created_count: created.length, tasks: created })
})

export default tasks
