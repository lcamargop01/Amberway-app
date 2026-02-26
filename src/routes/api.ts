// AI Analysis, Dashboard, Settings & Misc API routes
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification } from '../lib/db'

const api = new Hono<{ Bindings: Bindings }>()

// ============================================================
// DASHBOARD
// ============================================================
api.get('/dashboard', async (c) => {
  const { DB } = c.env

  // KPI stats
  const totalDeals = await DB.prepare("SELECT COUNT(*) as count, SUM(value) as total FROM deals WHERE status='active'").first() as any
  const wonDeals = await DB.prepare("SELECT COUNT(*) as count, SUM(value) as total FROM deals WHERE status='won'").first() as any
  const totalContacts = await DB.prepare("SELECT COUNT(*) as count FROM contacts WHERE type != 'supplier'").first() as any
  const openInvoices = await DB.prepare("SELECT COUNT(*) as count, SUM(amount_due) as total FROM invoices WHERE status IN ('sent','viewed','overdue')").first() as any
  const pendingPOs = await DB.prepare("SELECT COUNT(*) as count FROM purchase_orders WHERE status NOT IN ('received','cancelled')").first() as any
  const unreadNotifications = await DB.prepare("SELECT COUNT(*) as count FROM notifications WHERE read=0").first() as any

  // Deals by stage
  const { results: byStage } = await DB.prepare(`
    SELECT stage, COUNT(*) as count, SUM(value) as value 
    FROM deals WHERE status='active' GROUP BY stage ORDER BY count DESC
  `).all()

  // Overdue tasks
  const { results: overdueTasks } = await DB.prepare(`
    SELECT t.*, d.title as deal_title, c.first_name || ' ' || c.last_name as contact_name
    FROM tasks t
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE t.status IN ('pending','in_progress') AND date(t.due_date) < date('now')
    ORDER BY t.due_date ASC LIMIT 10
  `).all()

  // Due today
  const { results: dueToday } = await DB.prepare(`
    SELECT t.*, d.title as deal_title, c.first_name || ' ' || c.last_name as contact_name
    FROM tasks t
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE t.status IN ('pending','in_progress') AND date(t.due_date) = date('now')
    ORDER BY t.priority DESC LIMIT 10
  `).all()

  // Recent activity
  const { results: recentActivity } = await DB.prepare(`
    SELECT al.*, d.title as deal_title, c.first_name || ' ' || c.last_name as contact_name
    FROM activity_log al
    LEFT JOIN deals d ON al.deal_id = d.id
    LEFT JOIN contacts c ON al.contact_id = c.id
    ORDER BY al.created_at DESC LIMIT 15
  `).all()

  // Active POs needing attention
  const { results: activePOs } = await DB.prepare(`
    SELECT po.*, s.name as supplier_name, d.title as deal_title
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN deals d ON po.deal_id = d.id
    WHERE po.status NOT IN ('received','cancelled','draft')
    ORDER BY po.updated_at DESC LIMIT 8
  `).all()

  // Recent communications
  const { results: recentComms } = await DB.prepare(`
    SELECT comm.*, c.first_name || ' ' || c.last_name as contact_name, d.title as deal_title
    FROM communications comm
    LEFT JOIN contacts c ON comm.contact_id = c.id
    LEFT JOIN deals d ON comm.deal_id = d.id
    ORDER BY comm.created_at DESC LIMIT 10
  `).all()

  // Notifications
  const { results: notifications } = await DB.prepare(`
    SELECT * FROM notifications WHERE read=0 ORDER BY created_at DESC LIMIT 10
  `).all()

  // Monthly revenue trend (last 6 months)
  const { results: revenueTrend } = await DB.prepare(`
    SELECT strftime('%Y-%m', paid_at) as month, SUM(total) as revenue, COUNT(*) as count
    FROM invoices WHERE status='paid' AND paid_at IS NOT NULL
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all()

  return c.json({
    kpis: {
      active_deals: totalDeals,
      won_deals: wonDeals,
      total_contacts: totalContacts,
      open_invoices: openInvoices,
      pending_pos: pendingPOs,
      unread_notifications: unreadNotifications
    },
    deals_by_stage: byStage,
    overdue_tasks: overdueTasks,
    due_today: dueToday,
    recent_activity: recentActivity,
    active_pos: activePOs,
    recent_communications: recentComms,
    notifications,
    revenue_trend: revenueTrend
  })
})

// ============================================================
// AI ANALYSIS
// ============================================================
api.post('/ai/analyze-deal', async (c) => {
  const { DB } = c.env
  const { deal_id } = await c.req.json()

  const deal = await DB.prepare(`
    SELECT d.*, c.first_name || ' ' || c.last_name as contact_name, c.email as contact_email
    FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?
  `).bind(deal_id).first() as any

  if (!deal) return c.json({ error: 'Deal not found' }, 404)

  const { results: comms } = await DB.prepare(`
    SELECT type, direction, subject, summary, body, created_at 
    FROM communications WHERE deal_id = ? ORDER BY created_at DESC LIMIT 10
  `).bind(deal_id).all()

  const { results: tasks } = await DB.prepare(`
    SELECT title, type, status, due_date FROM tasks WHERE deal_id = ? ORDER BY due_date ASC LIMIT 5
  `).bind(deal_id).all()

  // Try real AI if key available
  const apiKey = c.env.OPENAI_API_KEY
  let summary = ''
  let nextAction = ''

  if (apiKey) {
    try {
      const prompt = `You are a CRM assistant for Amberway Equine LLC, a company that sells high-quality barn and equine equipment (stalls, fencing, lighting, flooring, fans, horse walkers, etc.).

Deal: "${deal.title}"
Contact: ${deal.contact_name || 'Unknown'}
Stage: ${deal.stage}
Value: $${deal.value || 0}
Priority: ${deal.priority}

Recent Communications (${comms.length}):
${comms.slice(0, 5).map((c: any) => `- [${c.type}/${c.direction}] ${c.subject || ''}: ${(c.summary || c.body || '').substring(0, 100)}`).join('\n')}

Open Tasks:
${tasks.map((t: any) => `- [${t.status}] ${t.title} (due: ${t.due_date || 'no date'})`).join('\n')}

Please provide:
1. STATUS SUMMARY (2-3 sentences about where this deal stands)
2. NEXT ACTION (1 clear action to take, be specific)
3. RISK LEVEL (low/medium/high with reason)

Format as JSON: {"summary": "...", "next_action": "...", "risk": "low|medium|high", "risk_reason": "..."}`

      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      })

      if (aiResp.ok) {
        const aiData = await aiResp.json() as any
        const parsed = JSON.parse(aiData.choices[0].message.content)
        summary = parsed.summary
        nextAction = parsed.next_action
        
        await DB.prepare(`
          UPDATE deals SET ai_status_summary=?, ai_next_action=?, ai_last_analyzed=CURRENT_TIMESTAMP WHERE id=?
        `).bind(summary, nextAction, deal_id).run()
        
        await DB.prepare(`
          INSERT INTO ai_analysis_log (entity_type, entity_id, analysis_type, output_data, model, tokens_used)
          VALUES ('deal', ?, 'status_update', ?, 'gpt-4o-mini', ?)
        `).bind(deal_id, JSON.stringify(parsed), aiData.usage?.total_tokens || 0).run()
        
        return c.json({ success: true, summary, next_action: nextAction, risk: parsed.risk, risk_reason: parsed.risk_reason })
      }
    } catch (e) {
      console.error('AI error:', e)
    }
  }

  // Fallback: rule-based analysis
  const stageDescriptions: Record<string, string> = {
    lead: 'New lead in the pipeline. Initial contact needs to be made to qualify the opportunity.',
    qualified: 'Lead has been qualified. Working on understanding their specific needs and budget.',
    proposal_sent: 'A proposal has been sent. Following up to address questions and move to estimate.',
    estimate_sent: 'Estimate has been sent to the customer. Awaiting acceptance.',
    estimate_accepted: 'Customer accepted the estimate! Ready to send invoice.',
    invoice_sent: 'Invoice has been sent. Awaiting payment.',
    invoice_paid: 'Payment received! Time to place the order with suppliers.',
    order_placed: 'Order has been placed with suppliers. Awaiting confirmation.',
    order_confirmed: 'Suppliers have confirmed the order. Awaiting shipping.',
    shipping: 'Order is in transit. Track shipment and update customer.',
    delivered: 'Order delivered! Follow up to ensure customer satisfaction.',
    completed: 'Deal successfully completed.',
    lost: 'Deal was lost.',
    on_hold: 'Deal is on hold.'
  }

  const nextActions: Record<string, string> = {
    lead: 'Call the prospect within 24 hours to introduce Amberway Equine and understand their project needs.',
    qualified: 'Send product catalog and schedule a design consultation at their facility.',
    proposal_sent: `Follow up with ${deal.contact_name || 'the customer'} within 3 days to discuss the proposal.`,
    estimate_sent: 'Call to confirm they received the estimate and answer any questions.',
    estimate_accepted: 'Create and send the invoice in QuickBooks immediately.',
    invoice_sent: 'Follow up in 2 days to confirm invoice received and discuss payment timeline.',
    invoice_paid: 'URGENT: Place order with suppliers TODAY. Request quotes if needed.',
    order_placed: 'Contact supplier to confirm order and get ETAs within 24 hours.',
    order_confirmed: 'Get shipping schedule and tracking information from supplier.',
    shipping: 'Send tracking information to customer and provide estimated delivery date.',
    delivered: 'Call customer to confirm delivery and ensure everything arrived in perfect condition.',
    completed: 'Request a review and ask for referrals from this satisfied customer.',
    on_hold: 'Reach out to understand if circumstances have changed and re-engage.'
  }

  summary = stageDescriptions[deal.stage] || 'Deal in progress.'
  nextAction = nextActions[deal.stage] || 'Follow up with the customer.'

  await DB.prepare(`
    UPDATE deals SET ai_status_summary=?, ai_next_action=?, ai_last_analyzed=CURRENT_TIMESTAMP WHERE id=?
  `).bind(summary, nextAction, deal_id).run()

  return c.json({ success: true, summary, next_action: nextAction, risk: 'medium', risk_reason: 'AI analysis unavailable - using smart defaults' })
})

// ============================================================
// AI NEEDS-ATTENTION SCAN  (GET /api/ai/needs-attention)
// Scans every active deal and determines what action is needed.
// Uses smart rules (always fast) + optional OpenAI for richer insight.
// ============================================================
api.get('/ai/needs-attention', async (c) => {
  const { DB } = c.env

  // Pull all active deals with contact info and last comm date
  const { results: deals } = await DB.prepare(`
    SELECT d.*,
      c.first_name || ' ' || c.last_name  AS contact_name,
      c.email   AS contact_email,
      c.mobile  AS contact_phone,
      c.phone   AS contact_phone2,
      COALESCE(co.name,'')                AS company_name,
      (SELECT MAX(created_at) FROM communications
        WHERE deal_id = d.id)             AS last_comm_at,
      (SELECT COUNT(*) FROM tasks
        WHERE deal_id = d.id
          AND status IN ('pending','in_progress')
          AND date(due_date) <= date('now')) AS overdue_task_count,
      (SELECT COUNT(*) FROM tasks
        WHERE deal_id = d.id
          AND status IN ('pending','in_progress')) AS open_task_count
    FROM deals d
    LEFT JOIN contacts c  ON d.contact_id  = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    WHERE d.status = 'active'
    ORDER BY d.value DESC
  `).all()

  const now = Date.now()
  const DAY = 86400000

  // Stage-level rules: { urgency, action, icon, daysBeforeStale }
  const STAGE_RULES: Record<string, { urgency: string; action: string; icon: string; stale: number }> = {
    lead:              { urgency:'high',   action:'Call to qualify — new lead in pipeline',        icon:'fa-phone',          stale: 2  },
    qualified:         { urgency:'high',   action:'Send estimate / product overview',              icon:'fa-file-lines',     stale: 3  },
    proposal_sent:     { urgency:'medium', action:'Follow up — no reply yet?',                     icon:'fa-reply',          stale: 3  },
    estimate_sent:     { urgency:'medium', action:'Follow up on estimate',                         icon:'fa-clock',          stale: 3  },
    estimate_accepted: { urgency:'urgent', action:'Send invoice NOW — estimate accepted!',         icon:'fa-dollar-sign',    stale: 1  },
    invoice_sent:      { urgency:'high',   action:'Follow up on payment',                          icon:'fa-credit-card',    stale: 5  },
    invoice_paid:      { urgency:'urgent', action:'Place order with supplier TODAY',               icon:'fa-cart-shopping',  stale: 1  },
    order_placed:      { urgency:'medium', action:'Confirm order with supplier',                   icon:'fa-box',            stale: 2  },
    order_confirmed:   { urgency:'medium', action:'Get shipping ETA from supplier',                icon:'fa-truck',          stale: 3  },
    shipping:          { urgency:'high',   action:'Send tracking info to customer',                icon:'fa-share',          stale: 2  },
    delivered:         { urgency:'medium', action:'Confirm delivery — all good?',                  icon:'fa-circle-check',   stale: 1  },
    completed:         { urgency:'low',    action:'Ask for a referral / review',                   icon:'fa-star',           stale: 30 },
    on_hold:           { urgency:'low',    action:'Re-check — any change in circumstances?',       icon:'fa-pause',          stale: 14 },
  }

  const URGENCY_ORDER: Record<string, number> = { urgent:0, high:1, medium:2, low:3 }

  const items: any[] = []

  for (const deal of deals as any[]) {
    const rule = STAGE_RULES[deal.stage] || { urgency:'medium', action:'Follow up', icon:'fa-comment', stale:5 }
    const daysSinceComm = deal.last_comm_at
      ? Math.floor((now - new Date(deal.last_comm_at).getTime()) / DAY)
      : 999
    const daysSinceUpdate = deal.updated_at
      ? Math.floor((now - new Date(deal.updated_at).getTime()) / DAY)
      : 999

    // Escalate urgency if stale
    let urgency = rule.urgency
    if (daysSinceComm >= rule.stale * 2) urgency = 'urgent'
    else if (daysSinceComm >= rule.stale)  urgency = urgency === 'low' ? 'medium' : urgency === 'medium' ? 'high' : 'urgent'

    // Escalate further if overdue tasks exist
    if (deal.overdue_task_count > 0 && urgency !== 'urgent') urgency = 'high'

    // Build reason tag
    const reasons: string[] = []
    if (deal.overdue_task_count > 0) reasons.push(`${deal.overdue_task_count} overdue task${deal.overdue_task_count>1?'s':''}`)
    if (daysSinceComm < 999) reasons.push(`last contact ${daysSinceComm}d ago`)
    else reasons.push('never contacted')

    items.push({
      deal_id:          deal.id,
      deal_title:       deal.title,
      contact_name:     deal.contact_name || '',
      contact_email:    deal.contact_email || '',
      contact_phone:    deal.contact_phone || deal.contact_phone2 || '',
      company_name:     deal.company_name  || '',
      stage:            deal.stage,
      value:            deal.value         || 0,
      urgency,
      action:           rule.action,
      icon:             rule.icon,
      days_since_comm:  daysSinceComm < 999 ? daysSinceComm : null,
      overdue_tasks:    deal.overdue_task_count,
      open_tasks:       deal.open_task_count,
      reasons,
    })
  }

  // Sort: urgent → high → medium → low, then by value desc
  items.sort((a, b) =>
    (URGENCY_ORDER[a.urgency] ?? 2) - (URGENCY_ORDER[b.urgency] ?? 2) ||
    b.value - a.value
  )

  // Auto-update deal priorities in DB (fire-and-forget, no await)
  for (const item of items) {
    DB.prepare(`UPDATE deals SET priority=?, updated_at=updated_at WHERE id=?`)
      .bind(item.urgency === 'urgent' ? 'urgent' : item.urgency === 'high' ? 'high' : item.urgency === 'medium' ? 'medium' : 'low', item.deal_id)
      .run().catch(() => {})
  }

  return c.json({ items, total: items.length, scanned_at: new Date().toISOString() })
})

// ============================================================
// AI EMAIL DRAFT
// ============================================================
api.post('/ai/draft-email', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { deal_id, contact_id, intent, tone = 'professional and friendly' } = body

  // Load context
  let deal: any = null
  let contact: any = null

  if (deal_id) {
    deal = await DB.prepare(`
      SELECT d.*, c.first_name || ' ' || c.last_name as contact_name,
             c.email as contact_email,
             COALESCE(co.name, '') as company_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      WHERE d.id = ?
    `).bind(deal_id).first()
  }

  if (contact_id && !contact) {
    contact = await DB.prepare(`
      SELECT c.*, COALESCE(co.name, '') as company_name
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = ?
    `).bind(contact_id).first()
  }

  // Gather recent comms for context
  let recentComms: any[] = []
  if (deal_id || contact_id) {
    const commQuery = deal_id
      ? `SELECT type, direction, subject, body FROM communications WHERE deal_id = ? ORDER BY created_at DESC LIMIT 4`
      : `SELECT type, direction, subject, body FROM communications WHERE contact_id = ? ORDER BY created_at DESC LIMIT 4`
    const { results } = await DB.prepare(commQuery).bind(deal_id || contact_id).all()
    recentComms = results as any[]
  }

  const contactName = deal?.contact_name || (contact ? `${contact.first_name} ${contact.last_name}` : 'the customer')
  const firstName = deal?.contact_name?.split(' ')[0] || contact?.first_name || 'there'
  const company = deal?.company_name || contact?.company_name || ''
  const stageLabel: Record<string, string> = {
    lead: 'New Lead', qualified: 'Qualified', proposal_sent: 'Proposal Sent',
    estimate_sent: 'Estimate Sent', estimate_accepted: 'Estimate Accepted',
    invoice_sent: 'Invoice Sent', invoice_paid: 'Invoice Paid',
    order_placed: 'Order Placed', order_confirmed: 'Order Confirmed',
    shipping: 'In Transit', delivered: 'Delivered', completed: 'Completed'
  }

  const apiKey = c.env.OPENAI_API_KEY

  if (apiKey) {
    try {
      const systemPrompt = `You are a helpful sales assistant for Amberway Equine LLC — a company specialising in high-quality barn & equine equipment (stalls, stall mats, fencing, lighting, fans, horse walkers, rubber flooring, arena equipment, etc.).

Write emails that sound natural, warm and human. Never use corporate buzzwords. Keep it concise (under 200 words body). Always include a clear call-to-action.

Return ONLY valid JSON in this exact shape:
{"subject": "...", "body": "..."}`

      const userPrompt = `Write an email with tone: ${tone}.

Contact: ${contactName}${company ? ` (${company})` : ''}
${deal ? `Deal: ${deal.title} | Stage: ${stageLabel[deal.stage] || deal.stage} | Value: $${deal.value || 0}` : ''}
${recentComms.length ? `Recent comms: ${recentComms.map((r: any) => `[${r.type}/${r.direction}] ${r.subject || r.body?.substring(0, 60) || ''}`).join(' | ')}` : ''}

What to communicate: ${intent}

Use first name "${firstName}" in salutation. Sign off as the Amberway Equine team.`

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      })

      if (resp.ok) {
        const aiData = await resp.json() as any
        const parsed = JSON.parse(aiData.choices[0].message.content)
        return c.json({ success: true, subject: parsed.subject, body: parsed.body, ai: true })
      }
    } catch (e) {
      console.error('AI draft error:', e)
    }
  }

  // ── Fallback: smart template ────────────────────────────────
  const templates: Record<string, { subject: string; body: string }> = {
    default: {
      subject: `Following up — ${deal?.title || company || 'Your Project'}`,
      body: `Hi ${firstName},\n\nI wanted to follow up and see how things are going on your end.\n\nPlease don't hesitate to reach out with any questions — we're here to help make your project a success.\n\nBest regards,\nAmberway Equine Team`
    }
  }

  const tpl = templates.default
  return c.json({ success: true, subject: tpl.subject, body: tpl.body, ai: false })
})

// ============================================================
// NOTIFICATIONS
// ============================================================
api.get('/notifications', async (c) => {
  const { DB } = c.env
  const unreadOnly = c.req.query('unread') === 'true'
  let query = 'SELECT * FROM notifications'
  if (unreadOnly) query += ' WHERE read=0'
  query += ' ORDER BY created_at DESC LIMIT 50'
  const { results } = await DB.prepare(query).all()
  return c.json({ notifications: results })
})

api.patch('/notifications/:id/read', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('UPDATE notifications SET read=1 WHERE id=?').bind(id).run()
  return c.json({ success: true })
})

api.patch('/notifications/mark-all-read', async (c) => {
  const { DB } = c.env
  await DB.prepare('UPDATE notifications SET read=1').run()
  return c.json({ success: true })
})

// ============================================================
// SETTINGS
// ============================================================
api.get('/settings', async (c) => {
  const { DB } = c.env
  const { results } = await DB.prepare('SELECT key, value, type, description FROM settings ORDER BY key').all()
  const settingsMap: Record<string, any> = {}
  results.forEach((r: any) => {
    if (r.type === 'boolean') settingsMap[r.key] = r.value === 'true'
    else if (r.type === 'number') settingsMap[r.key] = parseFloat(r.value)
    else settingsMap[r.key] = r.value
  })
  return c.json({ settings: settingsMap, raw: results })
})

api.put('/settings', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  for (const [key, value] of Object.entries(body)) {
    await DB.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(key, String(value)).run()
  }
  return c.json({ success: true })
})

// ============================================================
// PRODUCTS
// ============================================================
api.get('/products', async (c) => {
  const { DB } = c.env
  const category = c.req.query('category')
  let query = 'SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.active=1'
  const params: any[] = []
  if (category) { query += ' AND p.category = ?'; params.push(category) }
  query += ' ORDER BY p.category, p.name'
  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ products: results })
})

// ============================================================
// GMAIL OAUTH
// ============================================================
api.get('/gmail/auth-url', async (c) => {
  const clientId = c.env.GMAIL_CLIENT_ID
  if (!clientId) {
    return c.json({ error: 'Gmail Client ID not configured. Add GMAIL_CLIENT_ID to secrets.' }, 400)
  }
  
  const redirectUri = `${new URL(c.req.url).origin}/api/gmail/callback`
  const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly')
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`
  
  return c.json({ auth_url: authUrl })
})

api.get('/gmail/callback', async (c) => {
  const { DB } = c.env
  const code = c.req.query('code')
  
  if (!code) return c.html('<h1>Error: No code received</h1>', 400)
  
  try {
    const origin = new URL(c.req.url).origin
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GMAIL_CLIENT_ID || '',
        client_secret: c.env.GMAIL_CLIENT_SECRET || '',
        redirect_uri: `${origin}/api/gmail/callback`,
        grant_type: 'authorization_code'
      })
    })
    
    const tokenData = await tokenResp.json() as any
    
    if (tokenData.access_token) {
      await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gmail_access_token', ?)")
        .bind(tokenData.access_token).run()
      await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gmail_connected', 'true')").run()
      
      if (tokenData.refresh_token) {
        await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gmail_refresh_token', ?)")
          .bind(tokenData.refresh_token).run()
      }
      
      return c.html(`
        <html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2 style="color:#16a34a">✅ Gmail Connected Successfully!</h2>
          <p>You can close this window and return to the CRM.</p>
          <script>setTimeout(() => window.close(), 3000)</script>
        </body></html>
      `)
    }
    
    return c.html(`<h1>Error: ${tokenData.error || 'Failed to get token'}</h1>`, 400)
  } catch (e: any) {
    return c.html(`<h1>Error: ${e.message}</h1>`, 500)
  }
})

// ============================================================
// QUICKBOOKS
// ============================================================
api.get('/quickbooks/auth-url', async (c) => {
  const clientId = c.env.QB_CLIENT_ID
  if (!clientId) {
    return c.json({ error: 'QuickBooks Client ID not configured.' }, 400)
  }
  
  const redirectUri = `${new URL(c.req.url).origin}/api/quickbooks/callback`
  const scope = 'com.intuit.quickbooks.accounting'
  const state = Math.random().toString(36).substring(7)
  const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`
  
  return c.json({ auth_url: authUrl })
})

api.get('/quickbooks/callback', async (c) => {
  const { DB } = c.env
  const code = c.req.query('code')
  const realmId = c.req.query('realmId')
  
  if (!code) return c.html('<h1>Error: No code received</h1>', 400)

  try {
    const tokenResp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${c.env.QB_CLIENT_ID}:${c.env.QB_CLIENT_SECRET}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        redirect_uri: `${new URL(c.req.url).origin}/api/quickbooks/callback`,
        grant_type: 'authorization_code'
      })
    })
    
    const tokenData = await tokenResp.json() as any
    
    if (tokenData.access_token) {
      await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('qb_access_token', ?)").bind(tokenData.access_token).run()
      await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('qb_realm_id', ?)").bind(realmId).run()
      await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('quickbooks_connected', 'true')").run()
      
      if (tokenData.refresh_token) {
        await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('qb_refresh_token', ?)").bind(tokenData.refresh_token).run()
      }
      
      return c.html(`
        <html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2 style="color:#16a34a">✅ QuickBooks Connected Successfully!</h2>
          <p>Realm ID: ${realmId}</p>
          <p>You can close this window and return to the CRM.</p>
          <script>setTimeout(() => window.close(), 3000)</script>
        </body></html>
      `)
    }
    
    return c.html(`<h1>QB Error: ${JSON.stringify(tokenData)}</h1>`, 400)
  } catch (e: any) {
    return c.html(`<h1>Error: ${e.message}</h1>`, 500)
  }
})

// POST /api/quickbooks/create-estimate
api.post('/quickbooks/create-estimate', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  
  const token = await DB.prepare("SELECT value FROM settings WHERE key='qb_access_token'").first() as any
  const realmId = await DB.prepare("SELECT value FROM settings WHERE key='qb_realm_id'").first() as any
  
  if (!token?.value || !realmId?.value) {
    return c.json({ success: false, message: 'QuickBooks not connected. Please connect in Settings.' })
  }
  
  // Build QB estimate
  const qbEstimate = {
    CustomerRef: { value: body.customer_id || '1', name: body.customer_name },
    Line: (body.line_items || []).map((item: any, idx: number) => ({
      LineNum: idx + 1,
      Amount: (item.quantity || 1) * (item.unit_price || 0),
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        Qty: item.quantity || 1,
        UnitPrice: item.unit_price || 0,
        ItemRef: { value: item.qb_item_id || '1', name: item.description || item.name }
      }
    })),
    CustomerMemo: { value: body.notes || '' },
    ExpirationDate: body.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  }
  
  try {
    const resp = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId.value}/estimate?minorversion=65`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ Estimate: qbEstimate })
      }
    )
    
    if (resp.ok) {
      const data = await resp.json() as any
      const qbId = data.Estimate?.Id
      const qbUrl = `https://app.qbo.intuit.com/app/estimate?txnId=${qbId}`
      
      if (body.deal_id) {
        await DB.prepare('UPDATE deals SET quickbooks_estimate_id=?, quickbooks_estimate_url=?, stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
          .bind(qbId, qbUrl, 'estimate_sent', body.deal_id).run()
      }
      
      return c.json({ success: true, qb_id: qbId, url: qbUrl })
    } else {
      const err = await resp.json() as any
      return c.json({ success: false, error: JSON.stringify(err) })
    }
  } catch (e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// ============================================================  
// SEARCH
// ============================================================
api.get('/search', async (c) => {
  const { DB } = c.env
  const q = c.req.query('q') || ''
  if (!q || q.length < 2) return c.json({ results: [] })
  
  const s = `%${q}%`
  
  const { results: contacts } = await DB.prepare(`
    SELECT 'contact' as type, id, first_name || ' ' || last_name as title, email as subtitle, '/contacts/' || id as url
    FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? LIMIT 5
  `).bind(s, s, s).all()
  
  const { results: deals } = await DB.prepare(`
    SELECT 'deal' as type, id, title, stage as subtitle, '/deals/' || id as url
    FROM deals WHERE title LIKE ? AND status != 'archived' LIMIT 5
  `).bind(s).all()
  
  const { results: companies } = await DB.prepare(`
    SELECT 'company' as type, id, name as title, type as subtitle, '/companies/' || id as url
    FROM companies WHERE name LIKE ? LIMIT 3
  `).bind(s).all()
  
  return c.json({ results: [...contacts, ...deals, ...companies] })
})

// ============================================================
// ESTIMATES & INVOICES (lightweight)
// ============================================================
api.get('/estimates', async (c) => {
  const { DB } = c.env
  const deal_id = c.req.query('deal_id')
  let q = `SELECT e.*, c.first_name || ' ' || c.last_name as contact_name FROM estimates e LEFT JOIN contacts c ON e.contact_id = c.id WHERE 1=1`
  const p: any[] = []
  if (deal_id) { q += ' AND e.deal_id = ?'; p.push(deal_id) }
  q += ' ORDER BY e.created_at DESC LIMIT 20'
  const { results } = await DB.prepare(q).bind(...p).all()
  return c.json({ estimates: results })
})

api.post('/estimates', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { generateEstimateNumber } = await import('../lib/db')
  const estNum = generateEstimateNumber()
  const validUntil = body.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  
  const result = await DB.prepare(`
    INSERT INTO estimates (deal_id, contact_id, estimate_number, status, line_items, subtotal, tax_rate, tax_amount, discount_amount, total, notes, terms, valid_until)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.deal_id || null, body.contact_id || null, estNum, 'draft',
    JSON.stringify(body.line_items || []),
    body.subtotal || 0, body.tax_rate || 0, body.tax_amount || 0, body.discount_amount || 0, body.total || 0,
    body.notes || null, body.terms || null, validUntil
  ).run()
  
  return c.json({ estimate: { id: result.meta.last_row_id, estimate_number: estNum, ...body } }, 201)
})

api.get('/invoices', async (c) => {
  const { DB } = c.env
  const deal_id = c.req.query('deal_id')
  let q = `SELECT i.*, c.first_name || ' ' || c.last_name as contact_name FROM invoices i LEFT JOIN contacts c ON i.contact_id = c.id WHERE 1=1`
  const p: any[] = []
  if (deal_id) { q += ' AND i.deal_id = ?'; p.push(deal_id) }
  q += ' ORDER BY i.created_at DESC LIMIT 20'
  const { results } = await DB.prepare(q).bind(...p).all()
  return c.json({ invoices: results })
})

api.post('/invoices', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { generateInvoiceNumber } = await import('../lib/db')
  const invNum = generateInvoiceNumber()
  const dueDate = body.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  
  const result = await DB.prepare(`
    INSERT INTO invoices (deal_id, estimate_id, contact_id, invoice_number, status, line_items, 
      subtotal, tax_rate, tax_amount, discount_amount, total, amount_due, due_date, notes, terms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.deal_id || null, body.estimate_id || null, body.contact_id || null, invNum, 'draft',
    JSON.stringify(body.line_items || []),
    body.subtotal || 0, body.tax_rate || 0, body.tax_amount || 0, body.discount_amount || 0,
    body.total || 0, body.total || 0, dueDate, body.notes || null, body.terms || null
  ).run()
  
  return c.json({ invoice: { id: result.meta.last_row_id, invoice_number: invNum, ...body } }, 201)
})

// Mark invoice as paid
api.patch('/invoices/:id/paid', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const { payment_method, payment_reference } = await c.req.json()
  
  const inv = await DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first() as any
  if (!inv) return c.json({ error: 'Invoice not found' }, 404)
  
  await DB.prepare(`
    UPDATE invoices SET status='paid', amount_paid=total, amount_due=0, paid_at=CURRENT_TIMESTAMP,
      payment_method=?, payment_reference=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(payment_method || null, payment_reference || null, id).run()
  
  // Update deal stage
  if (inv.deal_id) {
    await DB.prepare('UPDATE deals SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind('invoice_paid', inv.deal_id).run()
    await logActivity(DB, {
      deal_id: inv.deal_id,
      entity_type: 'invoice',
      entity_id: parseInt(id),
      action: 'invoice_paid',
      description: `Invoice ${inv.invoice_number} marked as paid - $${inv.total}`,
      performed_by: 'user'
    })
    await createNotification(DB, {
      type: 'payment_received',
      title: `💰 Payment received! Invoice ${inv.invoice_number}`,
      message: `Amount: $${inv.total}. Ready to place order with suppliers.`,
      entity_type: 'deal',
      entity_id: inv.deal_id,
      priority: 'high',
      action_url: `/deals/${inv.deal_id}`
    })
  }
  
  return c.json({ success: true })
})

// ============================================================
// SUPPLIERS
// ============================================================
api.get('/suppliers', async (c) => {
  const { DB } = c.env
  const { results } = await DB.prepare('SELECT * FROM suppliers WHERE active=1 ORDER BY name').all()
  return c.json({ suppliers: results })
})

api.post('/suppliers', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const result = await DB.prepare(`
    INSERT INTO suppliers (name, contact_name, email, phone, website, product_categories, lead_time_days, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name, body.contact_name || null, body.email || null, body.phone || null,
    body.website || null, JSON.stringify(body.product_categories || []),
    body.lead_time_days || 14, body.notes || null
  ).run()
  return c.json({ supplier: { id: result.meta.last_row_id, ...body } }, 201)
})

// ============================================================
// COMPANIES
// ============================================================
api.get('/companies', async (c) => {
  const { DB } = c.env
  const type = c.req.query('type')
  let q = 'SELECT * FROM companies WHERE 1=1'
  const p: any[] = []
  if (type) { q += ' AND type = ?'; p.push(type) }
  q += ' ORDER BY name LIMIT 100'
  const { results } = await DB.prepare(q).bind(...p).all()
  return c.json({ companies: results })
})

api.post('/companies', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const result = await DB.prepare(`
    INSERT INTO companies (name, type, website, phone, email, address_line1, city, state, zip, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name, body.type || 'customer', body.website || null, body.phone || null,
    body.email || null, body.address_line1 || null, body.city || null,
    body.state || null, body.zip || null, body.notes || null
  ).run()
  return c.json({ company: { id: result.meta.last_row_id, ...body } }, 201)
})

export default api
