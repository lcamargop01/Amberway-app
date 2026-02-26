// Communications API - Email, SMS, Calls
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { logActivity, createNotification } from '../lib/db'

const communications = new Hono<{ Bindings: Bindings }>()

// GET /api/communications
communications.get('/', async (c) => {
  const { DB } = c.env
  const deal_id = c.req.query('deal_id')
  const contact_id = c.req.query('contact_id')
  const type = c.req.query('type')
  const limit = parseInt(c.req.query('limit') || '50')

  let query = `
    SELECT comm.*, 
      c.first_name || ' ' || c.last_name as contact_name,
      d.title as deal_title
    FROM communications comm
    LEFT JOIN contacts c ON comm.contact_id = c.id
    LEFT JOIN deals d ON comm.deal_id = d.id
    WHERE 1=1
  `
  const params: any[] = []

  if (deal_id) { query += ' AND comm.deal_id = ?'; params.push(deal_id) }
  if (contact_id) { query += ' AND comm.contact_id = ?'; params.push(contact_id) }
  if (type) { query += ' AND comm.type = ?'; params.push(type) }
  query += ' ORDER BY comm.created_at DESC LIMIT ?'
  params.push(limit)

  const { results } = await DB.prepare(query).bind(...params).all()
  return c.json({ communications: results })
})

// POST /api/communications - Log any communication
communications.post('/', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  const result = await DB.prepare(`
    INSERT INTO communications (deal_id, contact_id, company_id, type, direction, subject, body, 
      summary, status, from_address, to_address, gmail_message_id, gmail_thread_id, 
      twilio_sid, attachments, metadata, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.deal_id || null, body.contact_id || null, body.company_id || null,
    body.type || 'note', body.direction || 'outbound',
    body.subject || null, body.body || null, body.summary || null,
    body.status || 'sent', body.from_address || null, body.to_address || null,
    body.gmail_message_id || null, body.gmail_thread_id || null,
    body.twilio_sid || null, JSON.stringify(body.attachments || []),
    JSON.stringify(body.metadata || {}),
    body.sent_at || null
  ).run()

  // Update last contacted
  if (body.contact_id) {
    await DB.prepare('UPDATE contacts SET last_contacted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(body.contact_id).run()
  }

  // Update deal
  if (body.deal_id) {
    await DB.prepare('UPDATE deals SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.deal_id).run()
    await logActivity(DB, {
      deal_id: body.deal_id,
      contact_id: body.contact_id,
      entity_type: 'communication',
      entity_id: result.meta.last_row_id as number,
      action: `${body.type}_logged`,
      description: `${body.type} ${body.direction}: ${body.subject || '(no subject)'}`,
      performed_by: 'user'
    })
  }

  const newComm = await DB.prepare('SELECT * FROM communications WHERE id = ?')
    .bind(result.meta.last_row_id).first()
  return c.json({ communication: newComm }, 201)
})

// POST /api/communications/send-email - Send email via Gmail API
communications.post('/send-email', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  try {
    let emailSent = false
    let gmailMessageId = null
    let errorMsg = null

    // Try Gmail API if configured
    const gmailToken = await DB.prepare("SELECT value FROM settings WHERE key='gmail_access_token'").first() as any
    const gmailRefresh = c.env.GMAIL_REFRESH_TOKEN

    if (gmailToken?.value || gmailRefresh) {
      try {
        // Build email MIME
        const to = body.to
        const subject = body.subject || '(no subject)'
        const htmlBody = body.html || body.body || ''
        const emailContent = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          htmlBody
        ].join('\r\n')

        const encoded = btoa(unescape(encodeURIComponent(emailContent)))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

        let accessToken = gmailToken?.value
        
        // Refresh token if needed
        if (!accessToken && c.env.GMAIL_CLIENT_ID && c.env.GMAIL_CLIENT_SECRET && gmailRefresh) {
          const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: c.env.GMAIL_CLIENT_ID,
              client_secret: c.env.GMAIL_CLIENT_SECRET,
              refresh_token: gmailRefresh,
              grant_type: 'refresh_token'
            })
          })
          const refreshData = await refreshResp.json() as any
          accessToken = refreshData.access_token
          
          if (accessToken) {
            await DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('gmail_access_token', ?)")
              .bind(accessToken).run()
          }
        }

        if (accessToken) {
          let sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
          let sendBody: any = { raw: encoded }
          
          if (body.thread_id) {
            sendBody.threadId = body.thread_id
          }
          
          const sendResp = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(sendBody)
          })
          
          if (sendResp.ok) {
            const sentData = await sendResp.json() as any
            gmailMessageId = sentData.id
            emailSent = true
          } else {
            const errData = await sendResp.json() as any
            errorMsg = errData.error?.message || 'Gmail send failed'
          }
        }
      } catch (e: any) {
        errorMsg = e.message
      }
    }

    // Log the communication regardless
    const commResult = await DB.prepare(`
      INSERT INTO communications (deal_id, contact_id, type, direction, subject, body, status, 
        to_address, from_address, gmail_message_id, gmail_thread_id, sent_at)
      VALUES (?, ?, 'email', 'outbound', ?, ?, ?, ?, 'info@amberwayequine.com', ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      body.deal_id || null, body.contact_id || null, body.subject,
      body.html || body.body, emailSent ? 'sent' : 'draft',
      body.to, gmailMessageId, body.thread_id || null
    ).run()

    if (body.contact_id) {
      await DB.prepare('UPDATE contacts SET last_contacted_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.contact_id).run()
    }

    return c.json({
      success: emailSent,
      simulated: !emailSent,
      message: emailSent ? 'Email sent successfully via Gmail' : `Email logged (Gmail not fully configured: ${errorMsg || 'no token'})`,
      gmail_message_id: gmailMessageId,
      communication_id: commResult.meta.last_row_id
    })

  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// POST /api/communications/send-sms - Send SMS via Twilio
communications.post('/send-sms', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  try {
    let smsSent = false
    let twilioSid = null
    let errorMsg = null

    const accountSid = c.env.TWILIO_ACCOUNT_SID
    const authToken = c.env.TWILIO_AUTH_TOKEN
    const fromNumber = c.env.TWILIO_PHONE_NUMBER

    if (accountSid && authToken && fromNumber) {
      const twilioResp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: body.to,
            From: fromNumber,
            Body: body.message
          })
        }
      )
      
      if (twilioResp.ok) {
        const twilioData = await twilioResp.json() as any
        twilioSid = twilioData.sid
        smsSent = true
      } else {
        const errData = await twilioResp.json() as any
        errorMsg = errData.message
      }
    } else {
      errorMsg = 'Twilio not configured'
    }

    // Log communication
    const commResult = await DB.prepare(`
      INSERT INTO communications (deal_id, contact_id, type, direction, body, status, to_address, twilio_sid, sent_at)
      VALUES (?, ?, 'sms', 'outbound', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      body.deal_id || null, body.contact_id || null, body.message,
      smsSent ? 'sent' : 'failed', body.to, twilioSid
    ).run()

    if (body.contact_id) {
      await DB.prepare('UPDATE contacts SET last_contacted_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.contact_id).run()
    }

    return c.json({
      success: smsSent,
      simulated: !smsSent,
      message: smsSent ? 'SMS sent successfully' : `SMS logged (Twilio: ${errorMsg})`,
      twilio_sid: twilioSid,
      communication_id: commResult.meta.last_row_id
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// POST /api/communications/log-call - Log phone call
communications.post('/log-call', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()

  const result = await DB.prepare(`
    INSERT INTO communications (deal_id, contact_id, type, direction, subject, body, status, 
      duration_seconds, from_address, to_address, sent_at)
    VALUES (?, ?, 'call', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    body.deal_id || null, body.contact_id || null, body.direction || 'outbound',
    body.notes || 'Phone call', body.notes || '', body.status || 'completed',
    body.duration_seconds || 0, body.from_number || null, body.to_number || null
  ).run()

  if (body.contact_id) {
    await DB.prepare('UPDATE contacts SET last_contacted_at=CURRENT_TIMESTAMP WHERE id=?').bind(body.contact_id).run()
  }

  return c.json({ success: true, communication_id: result.meta.last_row_id })
})

// POST /api/communications/twilio-webhook - Receive Twilio SMS
communications.post('/twilio-webhook', async (c) => {
  const { DB } = c.env
  const form = await c.req.formData()

  const from = form.get('From') as string
  const body = form.get('Body') as string
  const sid = form.get('MessageSid') as string

  // Find contact by phone number
  const contact = await DB.prepare(`
    SELECT * FROM contacts WHERE phone = ? OR mobile = ?
  `).bind(from, from).first() as any

  await DB.prepare(`
    INSERT INTO communications (contact_id, type, direction, body, status, from_address, to_address, twilio_sid, sent_at)
    VALUES (?, 'sms', 'inbound', ?, 'received', ?, 'amberway', ?, CURRENT_TIMESTAMP)
  `).bind(contact?.id || null, body, from, sid).run()

  if (contact?.id) {
    await DB.prepare('UPDATE contacts SET last_contacted_at=CURRENT_TIMESTAMP WHERE id=?').bind(contact.id).run()
    await createNotification(DB, {
      type: 'inbound_sms',
      title: `New SMS from ${contact.first_name} ${contact.last_name}`,
      message: body.substring(0, 100),
      entity_type: 'contact',
      entity_id: contact.id,
      priority: 'high',
      action_url: `/contacts/${contact.id}`
    })
  } else {
    await createNotification(DB, {
      type: 'inbound_sms',
      title: `New SMS from unknown: ${from}`,
      message: body.substring(0, 100),
      priority: 'normal'
    })
  }

  return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, {
    'Content-Type': 'text/xml'
  })
})

// POST /api/communications/gmail-sync - Sync Gmail threads
communications.post('/gmail-sync', async (c) => {
  const { DB } = c.env
  
  try {
    const gmailToken = await DB.prepare("SELECT value FROM settings WHERE key='gmail_access_token'").first() as any
    if (!gmailToken?.value) {
      return c.json({ success: false, message: 'Gmail not connected. Please connect Gmail in Settings.' })
    }

    const accessToken = gmailToken.value
    
    // Fetch recent emails
    const listResp = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread',
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    
    if (!listResp.ok) {
      return c.json({ success: false, message: 'Failed to fetch Gmail. Token may be expired.' })
    }
    
    const listData = await listResp.json() as any
    const messages = listData.messages || []
    let synced = 0
    
    for (const msg of messages.slice(0, 10)) {
      const existing = await DB.prepare('SELECT id FROM communications WHERE gmail_message_id = ?')
        .bind(msg.id).first()
      if (existing) continue
      
      const msgResp = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      )
      
      if (!msgResp.ok) continue
      const msgData = await msgResp.json() as any
      
      const headers = msgData.payload?.headers || []
      const from = headers.find((h: any) => h.name === 'From')?.value || ''
      const to = headers.find((h: any) => h.name === 'To')?.value || ''
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)'
      
      // Try to match contact
      const emailMatch = from.match(/[\w.-]+@[\w.-]+\.\w+/)
      let contactId = null
      if (emailMatch) {
        const contact = await DB.prepare('SELECT id FROM contacts WHERE email = ?').bind(emailMatch[0]).first() as any
        contactId = contact?.id
      }
      
      await DB.prepare(`
        INSERT OR IGNORE INTO communications (contact_id, type, direction, subject, status, 
          from_address, to_address, gmail_message_id, gmail_thread_id, sent_at)
        VALUES (?, 'email', 'inbound', ?, 'received', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(contactId, subject, from, to, msg.id, msgData.threadId).run()
      
      synced++
    }
    
    return c.json({ success: true, synced, message: `Synced ${synced} new emails` })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// POST /api/communications/ai-draft  — AI-powered email draft
communications.post('/ai-draft', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  // body: { deal_id?, contact_id?, intent, tone?, extra_context? }

  try {
    // ── Build rich context from DB ─────────────────────────
    let dealCtx = ''
    let contactCtx = ''

    if (body.deal_id) {
      const deal = await DB.prepare(`
        SELECT d.*, c.first_name||' '||c.last_name as contact_name,
          c.email as contact_email, c.mobile as contact_phone,
          c.company_name
        FROM deals d LEFT JOIN contacts c ON d.contact_id=c.id
        WHERE d.id=?
      `).bind(body.deal_id).first() as any
      if (deal) {
        dealCtx = `Deal: "${deal.title}", Stage: ${deal.stage}, Value: $${deal.value||0}` +
          (deal.notes ? `, Notes: ${deal.notes}` : '')
      }
      if (deal?.contact_name && !body.contact_id) {
        contactCtx = `Contact: ${deal.contact_name}` +
          (deal.company_name ? ` at ${deal.company_name}` : '') +
          (deal.contact_email ? `, email: ${deal.contact_email}` : '')
      }
    }

    if (body.contact_id) {
      const contact = await DB.prepare(`
        SELECT first_name, last_name, company_name, email, type, notes FROM contacts WHERE id=?
      `).bind(body.contact_id).first() as any
      if (contact) {
        contactCtx = `Contact: ${contact.first_name} ${contact.last_name}` +
          (contact.company_name ? ` at ${contact.company_name}` : '') +
          (contact.email ? `, email: ${contact.email}` : '') +
          (contact.type ? `, type: ${contact.type}` : '')
      }
    }

    // Pull last 3 comms for thread awareness
    let threadCtx = ''
    if (body.deal_id || body.contact_id) {
      const filter = body.deal_id ? 'deal_id=?' : 'contact_id=?'
      const filterId = body.deal_id || body.contact_id
      const { results: recent } = await DB.prepare(`
        SELECT type, direction, subject, body, sent_at
        FROM communications
        WHERE ${filter}
        ORDER BY created_at DESC LIMIT 3
      `).bind(filterId).all() as any
      if (recent?.length) {
        threadCtx = '\n\nRecent communication history:\n' + recent.map((r: any) =>
          `- [${r.direction} ${r.type}] "${r.subject||'(no subject)'}" — ${r.body?.substring(0,120)||''}`
        ).join('\n')
      }
    }

    // ── OpenAI call ────────────────────────────────────────
    const openaiKey = c.env.OPENAI_API_KEY
    if (!openaiKey) {
      // Fallback: return a template draft without AI
      const fallbackSubject = body.intent || 'Follow up'
      const fallbackBody = `Hi,\n\nI wanted to follow up regarding ${dealCtx||'your inquiry'}.\n\n${body.extra_context||''}\n\nPlease let me know if you have any questions.\n\nBest regards,\nAmberway Equine LLC\n(561) 555-0100\ninfo@amberwayequine.com`
      return c.json({ success: true, ai: false, subject: fallbackSubject, body: fallbackBody, html: fallbackBody.replace(/\n/g,'<br>') })
    }

    const tone = body.tone || 'professional and friendly'
    const systemPrompt = `You are an email assistant for Amberway Equine LLC, a premium equine equipment supplier. 
Write emails that are ${tone}, concise, and helpful. Always sign off with the Amberway Equine team.
Company: Amberway Equine LLC | Website: amberwayequine.com | Phone: (your number)
Return ONLY a JSON object with keys "subject" (string) and "body" (string, plain text with \\n line breaks). No markdown, no code fences.`

    const userPrompt = `${contactCtx ? contactCtx + '\n' : ''}${dealCtx ? dealCtx + '\n' : ''}${threadCtx}

Task: ${body.intent}${body.extra_context ? '\nAdditional context: ' + body.extra_context : ''}

Write a complete, ready-to-send email. Return JSON only.`

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })
    })

    if (!aiResp.ok) {
      const errData = await aiResp.json() as any
      throw new Error(errData.error?.message || 'OpenAI request failed')
    }

    const aiData = await aiResp.json() as any
    const parsed = JSON.parse(aiData.choices[0].message.content)

    return c.json({
      success: true,
      ai: true,
      subject: parsed.subject || '',
      body: parsed.body || '',
      html: (parsed.body || '').replace(/\n/g, '<br>')
    })

  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default communications
