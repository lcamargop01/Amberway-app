// Amberway Equine CRM — App Logic
const API = '/api'

// ── STAGE CONFIG ────────────────────────────────────
const S = {
  lead:               { label:'New Lead',           color:'#636366', bg:'#F2F2F7', hex:'#8E8E93' },
  qualified:          { label:'Qualified',           color:'#007AFF', bg:'#EEF4FF', hex:'#007AFF' },
  proposal_sent:      { label:'Proposal Sent',       color:'#5856D6', bg:'#F5F3FF', hex:'#5856D6' },
  estimate_sent:      { label:'Estimate Sent',       color:'#FF9500', bg:'#FFF9EC', hex:'#FF9500' },
  estimate_accepted:  { label:'Estimate Accepted',   color:'#34C759', bg:'#F0FDF4', hex:'#34C759' },
  invoice_sent:       { label:'Invoice Sent',        color:'#00C7BE', bg:'#F0FFFE', hex:'#00C7BE' },
  invoice_paid:       { label:'Invoice Paid ✓',      color:'#34C759', bg:'#F0FDF4', hex:'#34C759' },
  order_placed:       { label:'Order Placed',        color:'#30D158', bg:'#F0FDF6', hex:'#30D158' },
  order_confirmed:    { label:'Order Confirmed',     color:'#32ADE6', bg:'#EFF9FF', hex:'#32ADE6' },
  shipping:           { label:'In Transit 🚚',       color:'#5856D6', bg:'#F5F3FF', hex:'#5856D6' },
  delivered:          { label:'Delivered ✓',         color:'#34C759', bg:'#F0FDF4', hex:'#34C759' },
  completed:          { label:'Completed 🎉',        color:'#34C759', bg:'#F0FDF4', hex:'#34C759' },
  lost:               { label:'Lost',                color:'#FF3B30', bg:'#FFF1F0', hex:'#FF3B30' },
  on_hold:            { label:'On Hold',             color:'#8E8E93', bg:'#F2F2F7', hex:'#8E8E93' },
}

const NEXT = {
  lead:               { label:'Call to qualify',            icon:'fa-phone',         urgent:false },
  qualified:          { label:'Send estimate',              icon:'fa-file-lines',    urgent:false },
  proposal_sent:      { label:'Follow up — no reply yet?',  icon:'fa-reply',         urgent:false },
  estimate_sent:      { label:'Follow up on estimate',      icon:'fa-clock',         urgent:false },
  estimate_accepted:  { label:'Send invoice NOW',           icon:'fa-dollar-sign',   urgent:true  },
  invoice_sent:       { label:'Follow up on payment',       icon:'fa-credit-card',   urgent:false },
  invoice_paid:       { label:'Place order TODAY',          icon:'fa-cart-shopping', urgent:true  },
  order_placed:       { label:'Confirm with supplier',      icon:'fa-phone',         urgent:false },
  order_confirmed:    { label:'Get shipping ETA',           icon:'fa-truck',         urgent:false },
  shipping:           { label:'Send tracking to customer',  icon:'fa-share',         urgent:false },
  delivered:          { label:'Confirm delivery OK',        icon:'fa-circle-check',  urgent:false },
  completed:          { label:'Ask for a referral',         icon:'fa-star',          urgent:false },
}

const PC = { urgent:'#FF3B30', high:'#FF9500', medium:'#FF9500', low:'#8E8E93' }
const PBG = { urgent:'#FFF1F0', high:'#FFF9EC', medium:'#F9F9F9', low:'#F2F2F7' }

const state = { page:'home', dealsFilter:'active', tasksFilter:'pending', ctab:'email' }

// ── NAVIGATION ───────────────────────────────────────
function navTo(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
  document.getElementById('page-'+name)?.classList.add('active')
  document.getElementById('ni-'+name)?.classList.add('active')
  state.page = name
  const loaders = { home: loadHome, deals: loadDeals, contacts: loadContacts, orders: loadOrders, tasks: loadTasks }
  loaders[name]?.()
}

// ── SHEETS ───────────────────────────────────────────
function openSheet(id) {
  const bdId = id.replace('sh-', 'bd-')
  document.getElementById(bdId)?.classList.add('open')
  requestAnimationFrame(() => document.getElementById(id)?.classList.add('open'))
}
function closeSheet(id) {
  document.getElementById(id)?.classList.remove('open')
  document.getElementById(id.replace('sh-','bd-'))?.classList.remove('open')
}

// ── HOME ─────────────────────────────────────────────
async function loadHome() {
  const h = new Date().getHours()
  document.getElementById('hdr-greet').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  document.getElementById('hdr-date').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })

  try {
    const { data } = await axios.get(`${API}/dashboard`)

    document.getElementById('k-deals').textContent = data.kpis?.active_deals?.count ?? 0
    const taskCount = (data.overdue_tasks?.length || 0) + (data.due_today?.length || 0)
    document.getElementById('k-tasks').textContent = taskCount
    document.getElementById('k-pipe').textContent = '$' + fmtMoney(data.kpis?.active_deals?.total || 0)

    // Badge
    const badge = document.getElementById('task-badge')
    if (taskCount > 0) { badge.textContent = taskCount; badge.classList.add('show') }
    else badge.classList.remove('show')

    renderActions(data)
    renderHomeDeals()
  } catch(e) {
    document.getElementById('home-actions').innerHTML = `<div class="loading" style="color:#C7C7CC"><i class="fas fa-horse"></i></div>`
  }
}

function renderActions(data) {
  const el = document.getElementById('home-actions')
  const items = []

  ;(data.overdue_tasks || []).forEach(t => items.push({
    bg:'#FFF1F0', color:'#FF3B30', icon:'fa-exclamation-circle',
    title: t.title,
    sub: `${t.deal_title || t.contact_name || 'No deal'} · Overdue`,
    urgent: true,
    onclick: `openTaskPanel('${encodeURIComponent(JSON.stringify(t))}')`
  }))

  ;(data.due_today || []).forEach(t => items.push({
    bg:'#FFF9EC', color:'#FF9500', icon:'fa-clock',
    title: t.title,
    sub: `${t.deal_title || t.contact_name || 'No deal'} · Due today`,
    urgent: false,
    onclick: `openTaskPanel('${encodeURIComponent(JSON.stringify(t))}')`
  }))

  ;(data.active_pos || []).filter(p => p.status === 'approved').forEach(po => items.push({
    bg:'#F0FDF4', color:'#34C759', icon:'fa-cart-shopping',
    title: `Place order: ${po.deal_title || po.po_number}`,
    sub: `Supplier: ${po.supplier_name} · Invoice paid`,
    urgent: true,
    onclick: `openPO(${po.id})`
  }))

  if (!items.length) {
    el.innerHTML = `
      <div class="all-good">
        <div style="width:42px;height:42px;background:#BBF7D0;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-check" style="color:#15803D;font-size:18px"></i>
        </div>
        <div>
          <div style="font-weight:700;font-size:16px;color:#15803D">All caught up!</div>
          <div style="font-size:13px;color:#4ADE80;margin-top:2px">Nothing urgent right now</div>
        </div>
      </div>`
    return
  }

  el.innerHTML = `<div class="inset-list" style="margin:0 16px">` +
    items.map(item => `
      <div class="action-card" onclick="${item.onclick}">
        <div class="icon-circle" style="background:${item.bg}">
          <i class="fas ${item.icon}" style="color:${item.color}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div class="row-main">${item.title}</div>
          <div class="row-sub">${item.sub}</div>
        </div>
        ${item.urgent
          ? `<span class="urgent-badge">URGENT</span>`
          : `<i class="fas fa-chevron-right row-chevron"></i>`}
      </div>
    `).join('') + `</div>`
}

async function renderHomeDeals() {
  const el = document.getElementById('home-deals')
  try {
    const { data } = await axios.get(`${API}/deals`, { params: { status:'active', limit:50 } })
    if (!data.deals?.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-handshake"></i><p>No active deals yet.<br>Tap + to add your first one.</p></div>`
      return
    }
    const sorted = [...data.deals].sort((a,b) => {
      const p = { urgent:0, high:1, medium:2, low:3 }
      return (p[a.priority]??2) - (p[b.priority]??2) || (b.value||0) - (a.value||0)
    })
    el.innerHTML = sorted.map(d => dealCard(d)).join('')
  } catch { el.innerHTML = '' }
}

// ── DEAL CARD ────────────────────────────────────────
function dealCard(d) {
  const st = S[d.stage] || S.lead
  const nx = NEXT[d.stage] || {}
  return `
    <div class="deal-card" style="border-left-color:${st.hex}" onclick="openDeal(${d.id})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div class="deal-title" style="flex:1">${d.title}</div>
        ${d.value > 0 ? `<div class="deal-value" style="white-space:nowrap">$${fmtMoney(d.value)}</div>` : ''}
      </div>
      ${d.contact_name ? `<div class="deal-contact"><i class="fas fa-user" style="margin-right:5px;font-size:11px"></i>${d.contact_name}</div>` : ''}
      <div class="deal-footer">
        <span class="stage-tag" style="background:${st.bg};color:${st.color}">${st.label}</span>
        ${nx.label ? `
          <div class="next-action" style="color:${nx.urgent ? '#FF3B30' : '#8E8E93'}">
            <i class="fas ${nx.icon}" style="font-size:11px"></i>
            <span>${nx.label}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

// ── PIPELINE PAGE ────────────────────────────────────
async function loadDeals() {
  const el = document.getElementById('deals-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/deals`, { params: { status: state.dealsFilter, limit:100 } })
    if (!data.deals?.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-handshake"></i><p>No ${state.dealsFilter} deals</p></div>`
      return
    }
    el.innerHTML = data.deals.map(d => dealCard(d)).join('')
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading deals</p></div>`
  }
}

function filterDeals(f, btn) {
  state.dealsFilter = f
  document.querySelectorAll('#deals-seg .seg-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  loadDeals()
}

// ── CONTACTS PAGE ────────────────────────────────────
async function loadContacts(q = '') {
  const el = document.getElementById('contacts-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/contacts`, { params: { search:q, limit:100 } })
    if (!data.contacts?.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>No contacts found</p></div>`
      return
    }
    const sorted = [...data.contacts].sort((a,b) => (a.last_name||'').localeCompare(b.last_name||''))
    el.innerHTML = `<div class="inset-list" style="margin:0 16px">` + sorted.map(c => contactRow(c)).join('') + `</div>`
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading</p></div>`
  }
}

function contactRow(c) {
  const init = `${c.first_name?.[0]||''}${c.last_name?.[0]||''}`
  const avatarColors = [
    ['#DBEAFE','#1D4ED8'],['#DCF5E7','#15803D'],['#FCE7F3','#9D174D'],
    ['#FEF9C3','#854D0E'],['#EDE9FE','#6D28D9'],['#FEE2E2','#991B1B']
  ]
  const [bg, fg] = avatarColors[(c.id||0) % avatarColors.length]
  const typeDot = { lead:'#8E8E93', prospect:'#007AFF', customer:'#34C759' }
  const tColor = typeDot[c.type] || '#8E8E93'

  return `
    <div class="contact-row" onclick="openContact(${c.id})">
      <div class="avatar" style="background:${bg};color:${fg}">${init}</div>
      <div style="flex:1;min-width:0">
        <div class="row-main">${c.first_name} ${c.last_name}</div>
        <div class="row-sub">${c.company_name ? c.company_name + ' · ' : ''}${c.mobile || c.phone || c.email || ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${tColor};display:block;margin-top:2px"></span>
        ${c.last_contacted_at ? `<span style="font-size:11px;color:#C7C7CC">${timeAgo(c.last_contacted_at)}</span>` : ''}
        <i class="fas fa-chevron-right row-chevron"></i>
      </div>
    </div>
  `
}

let _st = null
function debounceSearch(q) {
  clearTimeout(_st)
  _st = setTimeout(() => loadContacts(q), 280)
}

// ── ORDERS PAGE ──────────────────────────────────────
async function loadOrders() {
  const el = document.getElementById('orders-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/purchase-orders`, { params: { limit:50 } })
    const pos = data.purchase_orders || []
    if (!pos.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-box"></i><p>No orders yet</p></div>`
      return
    }

    document.getElementById('orders-subtitle').textContent = `${pos.length} order${pos.length !== 1 ? 's' : ''}`

    const POC = {
      draft:'#8E8E93', quote_requested:'#FF9500', quote_received:'#007AFF',
      approved:'#5856D6', submitted:'#32ADE6', confirmed:'#34C759',
      in_production:'#30D158', shipped:'#5856D6', partially_received:'#FF9500',
      received:'#34C759', cancelled:'#FF3B30'
    }

    el.innerHTML = pos.map(po => {
      const color = POC[po.status] || '#8E8E93'
      const tracking = safeJson(po.tracking_numbers, [])
      return `
        <div class="po-card" style="border-left-color:${color}" onclick="openPO(${po.id})">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="font-weight:700;font-size:16px;color:#1C1C1E">${po.po_number}</div>
            <div style="font-weight:700;color:#34C759;font-size:16px">$${fmtMoney(po.total)}</div>
          </div>
          <div style="font-size:13px;color:#8E8E93;margin-bottom:12px">${po.supplier_name||'—'}${po.deal_title ? ' · ' + po.deal_title : ''}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <span style="background:${color}20;color:${color};font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;letter-spacing:0.04em">${(po.status||'').replace(/_/g,' ').toUpperCase()}</span>
            ${po.expected_delivery ? `<span style="font-size:12px;color:#8E8E93">ETA ${po.expected_delivery}</span>` : ''}
          </div>
          ${tracking.length ? `
            <div style="margin-top:10px;padding-top:10px;border-top:0.5px solid #E5E5EA;font-size:13px;color:#5856D6;font-weight:600">
              <i class="fas fa-truck" style="margin-right:6px"></i>${tracking[0]}
            </div>` : ''}
          ${po.status === 'confirmed' ? `
            <button onclick="event.stopPropagation();addTracking(${po.id})" class="btn btn-primary" style="margin-top:12px;font-size:14px;padding:12px">
              <i class="fas fa-truck"></i> Add Tracking Number
            </button>` : ''}
          ${po.status === 'draft' || po.status === 'approved' ? `
            <button onclick="event.stopPropagation();requestQuote(${po.id})" class="btn btn-purple" style="margin-top:12px;font-size:14px;padding:12px">
              <i class="fas fa-paper-plane"></i> Request Quote
            </button>` : ''}
        </div>
      `
    }).join('')
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading orders</p></div>`
  }
}

// ── TASKS PAGE ───────────────────────────────────────
async function loadTasks() {
  const el = document.getElementById('tasks-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const status = state.tasksFilter === 'done' ? 'completed' : 'pending'
    const { data } = await axios.get(`${API}/tasks`, { params: { status, limit:100 } })
    const tasks = data.tasks || []
    if (!tasks.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-circle-check"></i><p>${state.tasksFilter === 'done' ? 'No completed tasks' : 'No pending tasks!'}</p></div>`
      return
    }

    el.innerHTML = `<div class="inset-list" style="margin:0 16px">` + tasks.map(t => {
      const ov = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
      const pc = PC[t.priority] || '#8E8E93'
      const enc = encodeURIComponent(JSON.stringify(t))
      return `
        <div class="task-row" onclick="openTaskPanel('${enc}')">
          <div class="task-check${t.status==='completed'?' done':''}" onclick="event.stopPropagation();completeTask(${t.id},this)">
            ${t.status === 'completed' ? `<i class="fas fa-check" style="font-size:11px;color:#fff"></i>` : ''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:600;color:${t.status==='completed'?'#C7C7CC':'#1C1C1E'};${t.status==='completed'?'text-decoration:line-through':''};line-height:1.3">${t.title}</div>
            <div style="font-size:12px;color:${ov?'#FF3B30':'#8E8E93'};margin-top:3px">
              ${t.deal_title ? t.deal_title + ' · ' : ''}${t.due_date ? (ov ? '⚠️ Overdue · ' : '') + new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'No date'}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span style="font-size:11px;font-weight:700;color:${pc}">${(t.priority||'medium').toUpperCase()}</span>
          </div>
        </div>
      `
    }).join('') + `</div>`

    const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length
    const badge = document.getElementById('task-badge')
    if (overdueCount > 0) { badge.textContent = overdueCount; badge.classList.add('show') }
    else badge.classList.remove('show')
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading tasks</p></div>`
  }
}

function filterTasks(f, btn) {
  state.tasksFilter = f
  document.querySelectorAll('#tasks-seg .seg-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  loadTasks()
}

// ── DEAL DETAIL ──────────────────────────────────────
async function openDeal(id) {
  openSheet('sh-deal')
  const el = document.getElementById('sh-deal-body')
  el.innerHTML = `<div class="loading" style="padding:60px"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/deals/${id}`)
    const d = data.deal
    const st = S[d.stage] || S.lead
    const nx = NEXT[d.stage] || {}
    const comms = (data.communications || []).slice(0, 4)
    const openTasks = (data.tasks || []).filter(t => t.status !== 'completed').slice(0, 4)

    el.innerHTML = `
      <div class="sheet-header" style="margin-bottom:0">
        <div style="flex:1;padding-right:8px">
          <div style="font-size:22px;font-weight:700;color:#1C1C1E;line-height:1.25;letter-spacing:-0.3px">${d.title}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
            <span class="stage-tag" style="background:${st.bg};color:${st.color}">${st.label}</span>
            ${d.value > 0 ? `<span style="font-size:17px;font-weight:700;color:#34C759">$${fmtMoney(d.value)}</span>` : ''}
          </div>
        </div>
        <button class="sheet-close" onclick="closeSheet('sh-deal')" style="flex-shrink:0;align-self:flex-start"><i class="fas fa-xmark"></i></button>
      </div>

      <div class="sheet-body">
        ${nx.label ? `
          <div class="next-banner" style="background:${nx.urgent?'#FFF1F0':'#EEF4FF'};border:1px solid ${nx.urgent?'#FFCCC7':'#BFDBFE'}">
            <div style="font-size:11px;font-weight:700;color:${nx.urgent?'#FF3B30':'#007AFF'};letter-spacing:0.05em;margin-bottom:5px">${nx.urgent?'⚡ ACTION REQUIRED':'👉 NEXT STEP'}</div>
            <div style="font-size:16px;font-weight:700;color:#1C1C1E;display:flex;align-items:center;gap:8px">
              <i class="fas ${nx.icon}" style="color:${nx.urgent?'#FF3B30':'#007AFF'}"></i>
              ${nx.label}
            </div>
          </div>` : ''}

        ${d.contact_name ? `
          <div class="section-head" style="padding:0 0 8px">Contact</div>
          <div class="info-block" style="margin-bottom:14px">
            <div style="padding:14px 16px">
              <div style="font-weight:700;font-size:16px;color:#1C1C1E;margin-bottom:12px">${d.contact_name}</div>
              <div class="contact-actions" style="grid-template-columns:repeat(${(d.contact_mobile||d.contact_phone)?((d.contact_email)?3:2):1},1fr)">
                ${d.contact_mobile||d.contact_phone ? `
                  <a href="tel:${d.contact_mobile||d.contact_phone}" class="contact-btn" style="background:#F0FDF4">
                    <i class="fas fa-phone" style="color:#34C759"></i>
                    <span style="color:#34C759">Call</span>
                  </a>
                  <a href="sms:${d.contact_mobile||d.contact_phone}" class="contact-btn" style="background:#EEF4FF">
                    <i class="fas fa-comment" style="color:#007AFF"></i>
                    <span style="color:#007AFF">Text</span>
                  </a>` : ''}
                ${d.contact_email ? `
                  <a href="mailto:${d.contact_email}" class="contact-btn" style="background:#F5F3FF">
                    <i class="fas fa-envelope" style="color:#5856D6"></i>
                    <span style="color:#5856D6">Email</span>
                  </a>` : ''}
              </div>
            </div>
          </div>` : ''}

        <div class="section-head" style="padding:0 0 8px">Move Stage</div>
        <div class="stage-scroll" style="margin-bottom:16px">
          <div class="stage-pills">
            ${Object.entries(S).filter(([k]) => !['lost','on_hold','completed'].includes(k)).map(([k,s]) => `
              <button class="s-pill${d.stage===k?' active':''}" 
                style="${d.stage===k?`border-color:${s.hex};background:${s.bg};color:${s.color}`:''}"
                onclick="moveStage(${d.id},'${k}')">${s.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="section-head" style="padding:0 0 8px">Quick Actions</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          <button onclick="commForDeal(${d.id},${d.contact_id},'email')" class="btn btn-gray" style="font-size:14px;padding:13px">
            <i class="fas fa-envelope" style="color:#5856D6"></i> Email
          </button>
          <button onclick="commForDeal(${d.id},${d.contact_id},'sms')" class="btn btn-gray" style="font-size:14px;padding:13px">
            <i class="fas fa-comment" style="color:#007AFF"></i> Text
          </button>
          <button onclick="genTasks(${d.id})" class="btn btn-gray" style="font-size:14px;padding:13px">
            <i class="fas fa-wand-magic-sparkles" style="color:#5856D6"></i> Auto Tasks
          </button>
          <button onclick="wonDeal(${d.id})" class="btn btn-gray" style="font-size:14px;padding:13px">
            <i class="fas fa-trophy" style="color:#FF9500"></i> Mark Won
          </button>
        </div>

        ${openTasks.length ? `
          <div class="section-head" style="padding:0 0 8px">Open Tasks (${openTasks.length})</div>
          <div class="info-block" style="margin-bottom:14px">
            ${openTasks.map(t => `
              <div class="mini-task">
                <div class="mini-check" onclick="completeTask(${t.id},this)" style="border-color:${PC[t.priority]||'#C7C7CC'}"></div>
                <div style="flex:1;font-size:14px;color:#3C3C43">${t.title}</div>
                <div style="font-size:12px;color:#8E8E93">${t.due_date ? new Date(t.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}</div>
              </div>`).join('')}
          </div>` : ''}

        ${comms.length ? `
          <div class="section-head" style="padding:0 0 8px">Recent Communications</div>
          <div class="info-block" style="margin-bottom:14px">
            ${comms.map(c => `
              <div class="info-row">
                <div style="width:32px;height:32px;border-radius:50%;background:${c.direction==='inbound'?'#DBEAFE':'#DCFCE7'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <i class="fas ${c.type==='email'?'fa-envelope':c.type==='sms'?'fa-comment':c.type==='call'?'fa-phone':'fa-note-sticky'}" style="font-size:13px;color:${c.direction==='inbound'?'#2563EB':'#15803D'}"></i>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;color:#3C3C43;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.subject||c.type}</div>
                  <div style="font-size:12px;color:#8E8E93">${timeAgo(c.created_at)}</div>
                </div>
              </div>`).join('')}
          </div>` : ''}

        <button onclick="lostDeal(${d.id})" class="btn btn-red-soft" style="margin-top:4px">Mark as Lost</button>
      </div>
    `
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading deal</p></div>`
  }
}

// ── CONTACT DETAIL ───────────────────────────────────
async function openContact(id) {
  openSheet('sh-contact')
  const el = document.getElementById('sh-contact-body')
  el.innerHTML = `<div class="loading" style="padding:60px"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/contacts/${id}`)
    const c = data.contact
    const deals = data.deals || []
    const comms = (data.communications || []).slice(0, 4)
    const init = `${c.first_name?.[0]||''}${c.last_name?.[0]||''}`
    const typeC = { lead:'#8E8E93', prospect:'#007AFF', customer:'#34C759' }
    const tc = typeC[c.type] || '#8E8E93'
    const tcBg = { lead:'#F2F2F7', prospect:'#EEF4FF', customer:'#F0FDF4' }[c.type] || '#F2F2F7'

    el.innerHTML = `
      <div class="sheet-header">
        <div style="display:flex;align-items:center;gap:14px;flex:1">
          <div style="width:52px;height:52px;border-radius:50%;background:#EEF4FF;color:#007AFF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex-shrink:0">${init}</div>
          <div>
            <div style="font-size:20px;font-weight:700;color:#1C1C1E;letter-spacing:-0.3px">${c.first_name} ${c.last_name}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:3px">
              <span style="background:${tcBg};color:${tc};font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;letter-spacing:0.04em">${(c.type||'lead').toUpperCase()}</span>
              ${c.company_name ? `<span style="font-size:13px;color:#8E8E93">${c.company_name}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="sheet-close" onclick="closeSheet('sh-contact')" style="flex-shrink:0;align-self:flex-start"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="sheet-body">
        <div class="contact-actions" style="margin-bottom:20px">
          ${c.mobile||c.phone ? `
            <a href="tel:${c.mobile||c.phone}" class="contact-btn" style="background:#F0FDF4">
              <i class="fas fa-phone" style="color:#34C759"></i>
              <span style="color:#34C759">Call</span>
            </a>
            <a href="sms:${c.mobile||c.phone}" class="contact-btn" style="background:#EEF4FF">
              <i class="fas fa-comment" style="color:#007AFF"></i>
              <span style="color:#007AFF">Text</span>
            </a>
          ` : '<div></div><div></div>'}
          ${c.email ? `
            <a href="mailto:${c.email}" class="contact-btn" style="background:#F5F3FF">
              <i class="fas fa-envelope" style="color:#5856D6"></i>
              <span style="color:#5856D6">Email</span>
            </a>
          ` : '<div></div>'}
        </div>

        <div class="info-block" style="margin-bottom:16px">
          ${c.email ? `<div class="info-row"><i class="fas fa-envelope"></i><span>${c.email}</span></div>` : ''}
          ${c.mobile||c.phone ? `<div class="info-row"><i class="fas fa-phone"></i><span>${c.mobile||c.phone}</span></div>` : ''}
          ${c.city||c.state ? `<div class="info-row"><i class="fas fa-location-dot"></i><span>${[c.city,c.state].filter(Boolean).join(', ')}</span></div>` : ''}
        </div>

        ${deals.length ? `
          <div class="section-head" style="padding:0 0 8px">Deals (${deals.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
            ${deals.map(d => {
              const s = S[d.stage] || S.lead
              return `
                <div onclick="closeSheet('sh-contact');openDeal(${d.id})" style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer">
                  <div>
                    <div style="font-weight:600;font-size:15px;color:#1C1C1E">${d.title}</div>
                    <span class="stage-tag" style="background:${s.bg};color:${s.color};margin-top:5px;display:inline-flex;font-size:11px">${s.label}</span>
                  </div>
                  ${d.value > 0 ? `<div style="font-weight:700;color:#34C759;font-size:15px">$${fmtMoney(d.value)}</div>` : ''}
                </div>
              `
            }).join('')}
          </div>` : ''}

        ${comms.length ? `
          <div class="section-head" style="padding:0 0 8px">Recent Communications</div>
          <div class="info-block" style="margin-bottom:16px">
            ${comms.map(c => `
              <div class="info-row">
                <i class="fas ${c.type==='email'?'fa-envelope':c.type==='sms'?'fa-comment':c.type==='call'?'fa-phone':'fa-note-sticky'}" style="color:${c.direction==='inbound'?'#007AFF':'#34C759'}"></i>
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;color:#3C3C43;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.subject||c.type}</div>
                  <div style="font-size:12px;color:#8E8E93">${timeAgo(c.created_at)}</div>
                </div>
              </div>`).join('')}
          </div>` : ''}

        ${c.notes ? `<div style="background:#FFFBEC;border-radius:14px;padding:14px;font-size:14px;color:#3C3C43;margin-bottom:16px;border:1px solid #FEF3C7">${c.notes}</div>` : ''}

        <button onclick="openAddDeal(${c.id});closeSheet('sh-contact')" class="btn btn-primary">
          <i class="fas fa-handshake"></i> New Deal for ${c.first_name}
        </button>
      </div>
    `
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading contact</p></div>`
  }
}

// ── TASK PANEL ───────────────────────────────────────
function openTaskPanel(raw) {
  let task
  try { task = JSON.parse(decodeURIComponent(raw)) } catch { try { task = JSON.parse(raw) } catch { return } }
  openSheet('sh-panel')
  const el = document.getElementById('sh-panel-body')
  const pc = PC[task.priority] || '#8E8E93'
  const pcBg = PBG[task.priority] || '#F2F2F7'
  const isOv = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
  const enc = encodeURIComponent(JSON.stringify(task))

  el.innerHTML = `
    <div class="sheet-header">
      <div style="flex:1;padding-right:8px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.05em;color:${isOv?'#FF3B30':pc};margin-bottom:6px">${isOv?'⚠️ OVERDUE':(task.priority||'medium').toUpperCase()+' PRIORITY'}</div>
        <div style="font-size:20px;font-weight:700;color:#1C1C1E;line-height:1.3">${task.title}</div>
        <div style="font-size:13px;color:#8E8E93;margin-top:6px;display:flex;flex-wrap:wrap;gap:10px">
          ${task.deal_title ? `<span><i class="fas fa-handshake" style="margin-right:4px"></i>${task.deal_title}</span>` : ''}
          ${task.due_date ? `<span><i class="fas fa-calendar" style="margin-right:4px"></i>${new Date(task.due_date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>` : ''}
        </div>
      </div>
      <button class="sheet-close" onclick="closeSheet('sh-panel')" style="flex-shrink:0;align-self:flex-start"><i class="fas fa-xmark"></i></button>
    </div>
    <div class="sheet-body" style="padding-bottom:24px">
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="completeTask(${task.id},null);closeSheet('sh-panel');if(state.page==='tasks')loadTasks();if(state.page==='home')loadHome()" class="btn btn-green">
          <i class="fas fa-circle-check"></i> Mark Complete
        </button>
        <button onclick="snoozeTask(${task.id},1);closeSheet('sh-panel')" class="btn btn-orange">
          <i class="fas fa-clock"></i> Snooze 1 Day
        </button>
        <button onclick="snoozeTask(${task.id},3);closeSheet('sh-panel')" class="btn btn-gray">
          <i class="fas fa-clock"></i> Snooze 3 Days
        </button>
        <button onclick="closeSheet('sh-panel');editTask('${enc}')" class="btn btn-gray">
          <i class="fas fa-pen"></i> Edit Task
        </button>
        <button onclick="delTask(${task.id});closeSheet('sh-panel')" class="btn btn-red-soft">
          <i class="fas fa-trash"></i> Delete Task
        </button>
      </div>
    </div>
  `
}

// ── PO DETAIL ────────────────────────────────────────
async function openPO(id) {
  openSheet('sh-panel')
  const el = document.getElementById('sh-panel-body')
  el.innerHTML = `<div class="loading" style="padding:60px"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/purchase-orders/${id}`)
    const po = data.purchase_order
    const POC = { draft:'#8E8E93',quote_requested:'#FF9500',quote_received:'#007AFF',approved:'#5856D6',submitted:'#32ADE6',confirmed:'#34C759',shipped:'#5856D6',received:'#34C759',cancelled:'#FF3B30' }
    const color = POC[po.status] || '#8E8E93'
    const lineItems = safeJson(po.line_items, [])
    const tracking = safeJson(po.tracking_numbers, [])

    el.innerHTML = `
      <div class="sheet-header">
        <div>
          <div style="font-size:22px;font-weight:700;color:#1C1C1E;letter-spacing:-0.3px">${po.po_number}</div>
          <span style="font-size:11px;font-weight:700;color:${color};background:${color}20;padding:3px 10px;border-radius:7px;letter-spacing:0.04em;display:inline-block;margin-top:4px">${(po.status||'').replace(/_/g,' ').toUpperCase()}</span>
        </div>
        <button class="sheet-close" onclick="closeSheet('sh-panel')" style="flex-shrink:0;align-self:flex-start"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="sheet-body" style="padding-bottom:24px">
        <div class="info-block" style="margin-bottom:14px">
          <div class="info-row"><i class="fas fa-building"></i><span style="font-weight:600">${po.supplier_name||'—'}</span></div>
          ${po.deal_title ? `<div class="info-row"><i class="fas fa-handshake"></i><span>${po.deal_title}</span></div>` : ''}
          <div class="info-row"><i class="fas fa-dollar-sign"></i><span style="font-weight:700;color:#34C759;font-size:17px">$${fmtMoney(po.total)}</span></div>
          ${po.expected_delivery ? `<div class="info-row"><i class="fas fa-calendar-check"></i><span>ETA: ${po.expected_delivery}</span></div>` : ''}
        </div>

        ${lineItems.length ? `
          <div class="section-head" style="padding:0 0 8px">Line Items</div>
          <div class="info-block" style="margin-bottom:14px">
            ${lineItems.map(i => `
              <div class="info-row">
                <i class="fas fa-box" style="color:#8E8E93"></i>
                <div style="flex:1">
                  <span style="font-size:14px;color:#3C3C43">${i.description||i.name} ×${i.quantity||1}</span>
                </div>
                <span style="font-size:14px;font-weight:600;color:#1C1C1E">$${fmtMoney((i.quantity||1)*(i.unit_price||0))}</span>
              </div>`).join('')}
          </div>` : ''}

        ${tracking.length ? `
          <div style="background:#EEF4FF;border-radius:14px;padding:14px;margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:#007AFF;margin-bottom:6px;letter-spacing:0.05em">TRACKING</div>
            ${tracking.map(t => `<div style="font-family:monospace;font-size:14px;color:#007AFF">${t}</div>`).join('')}
          </div>` : ''}

        <div style="display:flex;flex-direction:column;gap:10px">
          ${po.status==='draft'||po.status==='approved' ? `<button onclick="requestQuote(${po.id});closeSheet('sh-panel')" class="btn btn-purple"><i class="fas fa-paper-plane"></i> Request Quote from Supplier</button>` : ''}
          ${po.status==='confirmed' ? `<button onclick="closeSheet('sh-panel');addTracking(${po.id})" class="btn btn-primary"><i class="fas fa-truck"></i> Add Tracking Number</button>` : ''}
          <button onclick="promptPOStatus(${po.id})" class="btn btn-gray"><i class="fas fa-arrows-rotate"></i> Update Status</button>
        </div>
      </div>
    `
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading order</p></div>`
  }
}

// ── STAGE MOVE ───────────────────────────────────────
async function moveStage(dealId, stage) {
  try {
    await axios.patch(`${API}/deals/${dealId}/stage`, { stage })
    toast(`Moved to: ${S[stage]?.label}`, 'success')
    openDeal(dealId)
    if (state.page === 'home') loadHome()
    if (state.page === 'deals') loadDeals()
  } catch { toast('Error updating stage', 'error') }
}

async function wonDeal(id) {
  try {
    await axios.put(`${API}/deals/${id}`, { status:'won', stage:'completed', actual_close_date: new Date().toISOString().split('T')[0] })
    toast('🎉 Deal marked Won!', 'success')
    closeSheet('sh-deal')
    if (state.page === 'home') loadHome()
    if (state.page === 'deals') loadDeals()
  } catch { toast('Error', 'error') }
}

async function lostDeal(id) {
  if (!confirm('Mark this deal as Lost?')) return
  try {
    await axios.put(`${API}/deals/${id}`, { status:'lost', stage:'lost' })
    toast('Deal marked as lost', 'success')
    closeSheet('sh-deal')
    if (state.page === 'home') loadHome()
    if (state.page === 'deals') loadDeals()
  } catch { toast('Error', 'error') }
}

// ── FORMS ────────────────────────────────────────────
async function openAddDeal(prefillContactId) {
  await fillSel('sel-deal-contact', `${API}/contacts?limit=100`, 'contacts', c => ({ value:c.id, label:`${c.first_name} ${c.last_name}` }))
  document.getElementById('form-deal').reset()
  if (prefillContactId) document.getElementById('sel-deal-contact').value = prefillContactId
  openSheet('sh-new-deal')
}

async function openAddContact() {
  document.getElementById('form-contact').reset()
  openSheet('sh-new-contact')
}

async function openAddTask(prefill) {
  await fillSel('sel-task-deal', `${API}/deals?status=active&limit=100`, 'deals', d => ({ value:d.id, label:d.title }))
  const f = document.getElementById('form-task')
  f.reset()
  document.getElementById('task-edit-id').value = ''
  if (prefill) {
    f.querySelector('[name=title]').value = prefill.title || ''
    f.querySelector('[name=priority]').value = prefill.priority || 'medium'
    f.querySelector('[name=type]').value = prefill.type || 'follow_up'
    if (prefill.due_date) f.querySelector('[name=due_date]').value = prefill.due_date?.split('T')[0] || ''
    if (prefill.deal_id) f.querySelector('[name=deal_id]').value = prefill.deal_id
    document.getElementById('task-edit-id').value = prefill.id || ''
  } else {
    const t = new Date(); t.setDate(t.getDate() + 1)
    f.querySelector('[name=due_date]').value = t.toISOString().split('T')[0]
  }
  openSheet('sh-new-task')
}

function editTask(raw) {
  let task
  try { task = JSON.parse(decodeURIComponent(raw)) } catch { try { task = JSON.parse(raw) } catch { return } }
  openAddTask(task)
}

async function openLogComm(prefillDealId, prefillContactId, defaultTab) {
  await fillSel('sel-comm-contact', `${API}/contacts?limit=100`, 'contacts', c => ({ value:c.id, label:`${c.first_name} ${c.last_name}` }))
  await fillSel('sel-comm-deal', `${API}/deals?status=active&limit=100`, 'deals', d => ({ value:d.id, label:d.title }))
  document.getElementById('form-comm').reset()
  if (prefillDealId) document.getElementById('sel-comm-deal').value = prefillDealId
  if (prefillContactId) document.getElementById('sel-comm-contact').value = prefillContactId
  setCtab(defaultTab || 'email')
  openSheet('sh-log-comm')
}

function commForDeal(dealId, contactId, tab) {
  closeSheet('sh-deal')
  setTimeout(() => openLogComm(dealId, contactId, tab), 350)
}

// ── SUBMIT HANDLERS ──────────────────────────────────
async function submitDeal(e) {
  e.preventDefault()
  const d = Object.fromEntries(new FormData(e.target))
  try {
    const { data } = await axios.post(`${API}/deals`, d)
    try { await axios.post(`${API}/tasks/generate`, { deal_id: data.deal.id }) } catch {}
    toast('Deal created!', 'success')
    closeSheet('sh-new-deal')
    if (state.page === 'home') loadHome()
    if (state.page === 'deals') loadDeals()
  } catch { toast('Error creating deal', 'error') }
}

async function submitContact(e) {
  e.preventDefault()
  const d = Object.fromEntries(new FormData(e.target))
  try {
    await axios.post(`${API}/contacts`, d)
    toast('Contact added!', 'success')
    closeSheet('sh-new-contact')
    if (state.page === 'contacts') loadContacts()
  } catch { toast('Error adding contact', 'error') }
}

async function submitTask(e) {
  e.preventDefault()
  const d = Object.fromEntries(new FormData(e.target))
  const id = d._id; delete d._id
  try {
    if (id) { await axios.put(`${API}/tasks/${id}`, d); toast('Task updated!', 'success') }
    else { await axios.post(`${API}/tasks`, d); toast('Task added!', 'success') }
    closeSheet('sh-new-task')
    if (state.page === 'tasks') loadTasks()
    if (state.page === 'home') loadHome()
  } catch { toast('Error saving task', 'error') }
}

async function submitComm(e) {
  e.preventDefault()
  const d = Object.fromEntries(new FormData(e.target))
  const type = d._ctype
  try {
    if (type === 'email') {
      const c = await getContact(d.contact_id)
      const r = await axios.post(`${API}/communications/send-email`, { deal_id:d.deal_id||null, contact_id:d.contact_id||null, to:c?.email||'', subject:d.subject, html:d.body, body:d.body })
      toast(r.data.message || 'Email logged', r.data.success ? 'success' : 'warning')
    } else if (type === 'sms') {
      const c = await getContact(d.contact_id)
      const r = await axios.post(`${API}/communications/send-sms`, { deal_id:d.deal_id||null, contact_id:d.contact_id||null, to:c?.mobile||c?.phone||'', message:d.sms_body })
      toast(r.data.message || 'SMS logged', r.data.success ? 'success' : 'warning')
    } else if (type === 'call') {
      await axios.post(`${API}/communications/log-call`, { deal_id:d.deal_id||null, contact_id:d.contact_id||null, direction:'outbound', duration_seconds:(parseInt(d.duration||0)*60), notes:d.call_notes })
      toast('Call logged!', 'success')
    } else {
      await axios.post(`${API}/communications`, { deal_id:d.deal_id||null, contact_id:d.contact_id||null, type:'note', direction:'internal', body:d.note_body, status:'completed' })
      toast('Note saved!', 'success')
    }
    closeSheet('sh-log-comm')
  } catch(err) { toast('Error: ' + err.message, 'error') }
}

async function getContact(id) {
  if (!id) return null
  try { const { data } = await axios.get(`${API}/contacts/${id}`); return data.contact } catch { return null }
}

// ── COMM TABS ────────────────────────────────────────
function setCtab(tab) {
  ['email','sms','call','note'].forEach(t => {
    document.getElementById('ctab-'+t)?.classList.toggle('active', t === tab)
    const f = document.getElementById('cf-'+t)
    if (f) f.style.display = t === tab ? 'block' : 'none'
  })
  document.getElementById('ctype-val').value = tab
  const labels = { email:'Send Email', sms:'Send Text', call:'Log Call', note:'Save Note' }
  const icons  = { email:'fa-envelope', sms:'fa-comment', call:'fa-phone', note:'fa-note-sticky' }
  const btn = document.getElementById('comm-btn')
  if (btn) btn.innerHTML = `<i class="fas ${icons[tab]}"></i> ${labels[tab]||'Submit'}`
  state.ctab = tab
}

// ── TASK ACTIONS ─────────────────────────────────────
async function completeTask(id, el) {
  try {
    await axios.patch(`${API}/tasks/${id}/complete`)
    toast('Done ✓', 'success')
    if (el) { el.classList.add('done'); el.innerHTML = '<i class="fas fa-check" style="font-size:11px;color:#fff"></i>' }
    if (state.page === 'tasks') loadTasks()
    if (state.page === 'home') loadHome()
  } catch { toast('Error', 'error') }
}

async function snoozeTask(id, days) {
  try {
    await axios.patch(`${API}/tasks/${id}/snooze`, { days })
    toast(`Snoozed ${days} day${days>1?'s':''}`, 'success')
    if (state.page === 'tasks') loadTasks()
    if (state.page === 'home') loadHome()
  } catch { toast('Error', 'error') }
}

async function delTask(id) {
  try {
    await axios.delete(`${API}/tasks/${id}`)
    toast('Deleted', 'success')
    if (state.page === 'tasks') loadTasks()
  } catch { toast('Error', 'error') }
}

async function genTasks(dealId) {
  try {
    toast('Generating tasks…', 'info')
    const { data } = await axios.post(`${API}/tasks/generate`, { deal_id: dealId })
    toast(`${data.created_count} tasks generated!`, 'success')
    openDeal(dealId)
  } catch { toast('Error generating tasks', 'error') }
}

// ── ORDERS ───────────────────────────────────────────
async function requestQuote(poId) {
  try {
    const { data } = await axios.post(`${API}/purchase-orders/${poId}/request-quote`)
    toast(data.message || 'Quote requested!', 'success')
    loadOrders()
  } catch { toast('Error requesting quote', 'error') }
}

function addTracking(poId) {
  const carrier = prompt('Carrier? (UPS, FedEx, USPS, Estes, XPO, Other)')
  if (!carrier) return
  const tracking = prompt('Tracking number:')
  if (!tracking) return
  axios.post(`${API}/purchase-orders/${poId}/add-tracking`, { carrier, tracking_number: tracking })
    .then(() => { toast('Tracking added! Customer notified.', 'success'); loadOrders() })
    .catch(() => toast('Error adding tracking', 'error'))
}

async function promptPOStatus(id) {
  const s = ['draft','quote_requested','quote_received','approved','submitted','confirmed','in_production','shipped','received','cancelled']
  const status = prompt(`New status:\n${s.join(', ')}`)
  if (!status || !s.includes(status)) return
  try {
    await axios.put(`${API}/purchase-orders/${id}`, { status })
    toast('Status updated!', 'success')
    loadOrders(); closeSheet('sh-panel')
  } catch { toast('Error', 'error') }
}

// ── HELPERS ──────────────────────────────────────────
async function fillSel(selId, url, dataKey, mapper) {
  const sel = document.getElementById(selId)
  if (!sel) return
  try {
    const { data } = await axios.get(url)
    const items = data[dataKey] || []
    const first = sel.options[0]
    sel.innerHTML = ''
    sel.appendChild(first || new Option('None',''))
    items.forEach(item => { const o = mapper(item); sel.add(new Option(o.label, o.value)) })
  } catch {}
}

function fmtMoney(n) {
  const v = parseFloat(n) || 0
  if (v >= 1e6) return (v/1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v/1e3).toFixed(0) + 'K'
  return v.toLocaleString('en-US', { maximumFractionDigits:0 })
}

function timeAgo(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  if (s < 604800) return Math.floor(s/86400) + 'd ago'
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

function safeJson(str, fallback) {
  try { return JSON.parse(str || '[]') } catch { return fallback }
}

function toast(msg, type = 'success') {
  const colors = { success:'#34C759', error:'#FF3B30', warning:'#FF9500', info:'#007AFF' }
  const el = document.createElement('div')
  el.className = 'toast-msg'
  el.style.background = colors[type] || colors.info
  el.textContent = msg
  document.getElementById('toast-container').appendChild(el)
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(), 300) }, 3000)
}

// ── AI EMAIL DRAFT ───────────────────────────────────
const aiDraftState = { intent: '', dealId: null, contactId: null }

function openAIDraft() {
  // Pull current comm form context
  aiDraftState.dealId    = document.getElementById('sel-comm-deal')?.value    || null
  aiDraftState.contactId = document.getElementById('sel-comm-contact')?.value || null
  // Reset intent UI
  document.querySelectorAll('.ai-intent-btn').forEach(b => b.classList.remove('selected'))
  document.getElementById('ai-custom-intent').value = ''
  aiDraftState.intent = ''
  showAIStep('intent')
  openSheet('sh-ai-draft')
}

function selectIntent(text) {
  aiDraftState.intent = text
  document.querySelectorAll('.ai-intent-btn').forEach(b => b.classList.remove('selected'))
  event.currentTarget.classList.add('selected')
  document.getElementById('ai-custom-intent').value = ''
}

function showAIStep(step) {
  document.getElementById('ai-step-intent').style.display = step === 'intent' ? 'block' : 'none'
  document.getElementById('ai-step-draft').style.display  = step === 'draft'  ? 'block' : 'none'
}

async function runAIDraft() {
  const custom = document.getElementById('ai-custom-intent').value.trim()
  const intent = custom || aiDraftState.intent
  if (!intent) { toast('Please select or describe what you want to say', 'warning'); return }

  const tone = document.getElementById('ai-tone').value
  const btn  = document.getElementById('ai-generate-btn')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating\u2026'

  try {
    const { data } = await axios.post(`${API}/ai/draft-email`, {
      deal_id:    aiDraftState.dealId    || undefined,
      contact_id: aiDraftState.contactId || undefined,
      intent,
      tone
    })

    if (data.subject) document.getElementById('ai-draft-subject').value = data.subject
    if (data.body)    document.getElementById('ai-draft-body').value    = data.body

    showAIStep('draft')
    if (!data.ai) toast('Draft ready (smart template — add OPENAI_API_KEY for AI drafts)', 'info')
  } catch(err) {
    toast('Error generating draft', 'error')
  } finally {
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Generate Draft'
  }
}

async function useAIDraft(action) {
  const subject = document.getElementById('ai-draft-subject').value.trim()
  const body    = document.getElementById('ai-draft-body').value.trim()

  if (action === 'copy') {
    try {
      await navigator.clipboard.writeText('Subject: ' + subject + '\n\n' + body)
      toast('Copied to clipboard!', 'success')
    } catch {
      const ta = document.createElement('textarea')
      ta.value = 'Subject: ' + subject + '\n\n' + body
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      toast('Copied!', 'success')
    }
    return
  }

  if (action === 'mailapp') {
    document.getElementById('comm-subject').value = subject
    document.getElementById('comm-body').value    = body
    closeSheet('sh-ai-draft')
    setTimeout(() => _openMailAppNow(subject, body), 300)
    return
  }

  if (action === 'send') {
    document.getElementById('comm-subject').value = subject
    document.getElementById('comm-body').value    = body
    closeSheet('sh-ai-draft')
    setTimeout(() => document.getElementById('comm-btn')?.click(), 300)
    return
  }
}

function openMailApp() {
  const subject = document.getElementById('comm-subject')?.value || ''
  const body    = document.getElementById('comm-body')?.value    || ''
  _openMailAppNow(subject, body)
}

function _openMailAppNow(subject, body) {
  const contactSel = document.getElementById('sel-comm-contact')
  const contactId  = contactSel?.value

  const go = (email) => {
    const parts = []
    if (subject) parts.push('subject=' + encodeURIComponent(subject))
    if (body)    parts.push('body='    + encodeURIComponent(body))
    const qs = parts.length ? '?' + parts.join('&') : ''
    window.location.href = 'mailto:' + (email || '') + qs

    // Log outbound silently
    const dealId = document.getElementById('sel-comm-deal')?.value || aiDraftState.dealId || null
    if (contactId || dealId) {
      axios.post(`${API}/communications`, {
        contact_id: contactId || null,
        deal_id:    dealId,
        type:       'email',
        direction:  'outbound',
        subject:    subject || '(no subject)',
        body:       body    || '',
        status:     'sent'
      }).catch(() => {})
    }
  }

  if (contactId) {
    axios.get(`${API}/contacts/${contactId}`)
      .then(r => go(r.data?.contact?.email || ''))
      .catch(() => go(''))
  } else {
    go('')
  }
}

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadHome()
})
