// Contacts API routes
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification } from '../lib/db'

const contacts = new Hono<{ Bindings: Bindings }>()

// GET /api/contacts - List all contacts
contacts.get('/', async (c) => {
  const { DB } = c.env
  const search = c.req.query('search') || ''
  const type = c.req.query('type') || ''
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')

  let query = `
    SELECT c.*, co.name as company_name 
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE 1=1
  `
  const params: any[] = []

  if (search) {
    query += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR co.name LIKE ?)`
    const s = `%${search}%`
    params.push(s, s, s, s, s)
  }
  if (type) {
    query += ` AND c.type = ?`
    params.push(type)
  }
  query += ` ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const { results } = await DB.prepare(query).bind(...params).all()
  const countResult = await DB.prepare(`SELECT COUNT(*) as total FROM contacts WHERE 1=1 ${type ? 'AND type=?' : ''}`).bind(...(type ? [type] : [])).first()
  
  return c.json({ contacts: results, total: (countResult as any)?.total || 0 })
})

// GET /api/contacts/:id
contacts.get('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const contact = await DB.prepare(`
    SELECT c.*, co.name as company_name 
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    WHERE c.id = ?
  `).bind(id).first()
  
  if (!contact) return c.json({ error: 'Contact not found' }, 404)
  
  // Get recent deals
  const { results: deals } = await DB.prepare(`
    SELECT id, title, stage, status, value, updated_at FROM deals WHERE contact_id = ? ORDER BY updated_at DESC LIMIT 5
  `).bind(id).all()
  
  // Get recent communications
  const { results: comms } = await DB.prepare(`
    SELECT id, type, direction, subject, summary, created_at FROM communications WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10
  `).bind(id).all()

  // Get tasks
  const { results: tasks } = await DB.prepare(`
    SELECT id, title, type, priority, status, due_date FROM tasks WHERE contact_id = ? AND status != 'completed' ORDER BY due_date ASC LIMIT 5
  `).bind(id).all()
  
  return c.json({ contact, deals, communications: comms, tasks })
})

// POST /api/contacts
contacts.post('/', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  
  const result = await DB.prepare(`
    INSERT INTO contacts (company_id, first_name, last_name, email, phone, mobile, title, role, type, 
                          city, state, zip, address_line1, address_line2, country, notes, tags, source, preferred_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.company_id || null,
    body.first_name,
    body.last_name,
    body.email || null,
    body.phone || null,
    body.mobile || null,
    body.title || null,
    body.role || 'decision_maker',
    body.type || 'lead',
    body.city || null,
    body.state || null,
    body.zip || null,
    body.address_line1 || null,
    body.address_line2 || null,
    body.country || 'USA',
    body.notes || null,
    JSON.stringify(body.tags || []),
    body.source || null,
    body.preferred_contact || 'email'
  ).run()
  
  const newContact = await DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(result.meta.last_row_id).first()
  await logActivity(DB, { entity_type: 'contact', entity_id: result.meta.last_row_id as number, action: 'created', description: `Contact ${body.first_name} ${body.last_name} created`, performed_by: 'user' })
  
  return c.json({ contact: newContact }, 201)
})

// PUT /api/contacts/:id
contacts.put('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  await DB.prepare(`
    UPDATE contacts SET 
      company_id=?, first_name=?, last_name=?, email=?, phone=?, mobile=?, title=?, role=?, type=?,
      city=?, state=?, zip=?, address_line1=?, address_line2=?, notes=?, tags=?, source=?, preferred_contact=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).bind(
    body.company_id || null, body.first_name, body.last_name, body.email || null,
    body.phone || null, body.mobile || null, body.title || null, body.role || 'decision_maker',
    body.type || 'lead', body.city || null, body.state || null, body.zip || null,
    body.address_line1 || null, body.address_line2 || null, body.notes || null,
    JSON.stringify(body.tags || []), body.source || null, body.preferred_contact || 'email', id
  ).run()
  
  const updated = await DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first()
  return c.json({ contact: updated })
})

// DELETE /api/contacts/:id
contacts.delete('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// GET /api/contacts/:id/timeline
contacts.get('/:id/timeline', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  const { results: activities } = await DB.prepare(`
    SELECT * FROM activity_log WHERE contact_id = ? ORDER BY created_at DESC LIMIT 50
  `).bind(id).all()
  
  const { results: comms } = await DB.prepare(`
    SELECT * FROM communications WHERE contact_id = ? ORDER BY created_at DESC LIMIT 30
  `).bind(id).all()
  
  return c.json({ activities, communications: comms })
})

export default contacts
