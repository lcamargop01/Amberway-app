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

const state = { page:'home', dealsFilter:'active', tasksFilter:'pending', ctab:'email', ordersFilter:'shipments' }

// ── TRACKING STATE ──────────────────────────────────
const trackingState = { poId: null, dealId: null, contactId: null, shipmentId: null, trackingUrl: null, carrier: null, trackingNumber: null }

// ── NAVIGATION ───────────────────────────────────────
function navTo(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
  document.getElementById('page-'+name)?.classList.add('active')
  document.getElementById('ni-'+name)?.classList.add('active')
  state.page = name
  const loaders = { home: loadHome, deals: loadDeals, contacts: loadContacts, orders: loadShipments, tasks: loadTasks }
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
const state_home = { view: 'brian', allDeals: [] }

function setHomeView(view, btn) {
  state_home.view = view
  document.getElementById('brian-view').style.display = view === 'brian' ? '' : 'none'
  document.getElementById('laura-view').style.display  = view === 'laura' ? '' : 'none'
  document.getElementById('view-brian').style.background = view === 'brian' ? '#1C1C1E' : '#fff'
  document.getElementById('view-brian').style.color      = view === 'brian' ? '#fff'    : '#3C3C43'
  document.getElementById('view-brian').style.border     = view === 'brian' ? 'none'    : '2px solid #E5E5EA'
  document.getElementById('view-laura').style.background = view === 'laura' ? '#1C1C1E' : '#fff'
  document.getElementById('view-laura').style.color      = view === 'laura' ? '#fff'    : '#3C3C43'
  document.getElementById('view-laura').style.border     = view === 'laura' ? 'none'    : '2px solid #E5E5EA'
}

async function loadHome() {
  const h = new Date().getHours()
  document.getElementById('hdr-greet').textContent = h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon' : 'Good evening 🌙'
  document.getElementById('hdr-date').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }).toUpperCase()

  try {
    const [dashResp, dealsResp] = await Promise.all([
      axios.get(`${API}/dashboard`),
      axios.get(`${API}/deals`, { params: { status:'active', limit:200 } })
    ])
    const dash = dashResp.data
    const deals = dealsResp.data.deals || []
    state_home.allDeals = deals

    // Stage summary pills
    renderStagePills(dash.deals_by_stage || [])

    // Brian view
    renderBrianView(deals, dash)

    // Laura view
    renderLauraView(deals, dash)

    // Badge
    const taskCount = (dash.overdue_tasks?.length || 0) + (dash.due_today?.length || 0)
    const badge = document.getElementById('task-badge')
    if (taskCount > 0) { badge.textContent = taskCount; badge.classList.add('show') }
    else badge.classList.remove('show')

  } catch(e) {
    console.error(e)
    document.getElementById('home-outreach').innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading data</p></div>`
  }
}

function renderStagePills(byStage) {
  const el = document.getElementById('stage-pills')
  const order = ['lead','qualified','estimate_sent','estimate_accepted','invoice_sent','invoice_paid','order_placed','order_confirmed','shipping','delivered']
  const map = {}
  byStage.forEach(r => map[r.stage] = r.count)
  el.innerHTML = order.filter(s => map[s] > 0).map(s => {
    const st = S[s]
    return `<button onclick="navTo('deals');filterDealsByStage('${s}')"
      style="flex-shrink:0;padding:6px 12px;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;background:${st.bg};color:${st.color};white-space:nowrap">
      ${st.label} <span style="opacity:.7">${map[s]}</span>
    </button>`
  }).join('')
}

// ── BRIAN VIEW: who to reach out to ──────────────────
function renderBrianView(deals, dash) {
  const el = document.getElementById('home-outreach')

  // Group deals into outreach buckets
  const callBack   = deals.filter(d => ['lead','qualified'].includes(d.stage))
  const followUp   = deals.filter(d => ['estimate_sent','proposal_sent'].includes(d.stage))
  const hotDeals   = deals.filter(d => ['estimate_accepted','invoice_sent'].includes(d.stage))
  const shipping   = deals.filter(d => ['shipping','order_confirmed','order_placed','invoice_paid'].includes(d.stage))

  let html = ''

  if (hotDeals.length) {
    html += outreachSection('🔥 Needs Attention Now', hotDeals, {
      estimate_accepted: { action:'Send invoice', color:'#FF3B30', bg:'#FFF1F0' },
      invoice_sent:      { action:'Follow up on payment', color:'#FF9500', bg:'#FFF9EC' }
    }, true)
  }
  if (followUp.length) {
    html += outreachSection('📧 Follow Up on Estimates', followUp, {
      estimate_sent:  { action:'Follow up on estimate', color:'#FF9500', bg:'#FFF9EC' },
      proposal_sent:  { action:'Check in — any questions?', color:'#5856D6', bg:'#F5F3FF' }
    }, false)
  }
  if (callBack.length) {
    html += outreachSection('📞 New Leads to Contact', callBack, {
      lead:      { action:'Call to qualify', color:'#007AFF', bg:'#EEF4FF' },
      qualified: { action:'Send estimate', color:'#5856D6', bg:'#F5F3FF' }
    }, false)
  }
  if (shipping.length) {
    html += outreachSection('🚚 In Progress', shipping, {
      invoice_paid:    { action:'Place order with supplier', color:'#34C759', bg:'#F0FDF4' },
      order_placed:    { action:'Confirm with supplier', color:'#30D158', bg:'#F0FDF6' },
      order_confirmed: { action:'Get shipping ETA', color:'#32ADE6', bg:'#EFF9FF' },
      shipping:        { action:'Send tracking to customer', color:'#5856D6', bg:'#F5F3FF' }
    }, false)
  }

  if (!html) {
    html = `<div style="text-align:center;padding:48px 24px">
      <div style="font-size:48px;margin-bottom:12px">🎉</div>
      <div style="font-size:18px;font-weight:700;color:#1C1C1E">All caught up!</div>
      <div style="font-size:14px;color:#8E8E93;margin-top:6px">No outreach needed right now</div>
    </div>`
  }

  el.innerHTML = html
}

function outreachSection(title, deals, stageConfig, urgent) {
  const rows = deals.map(d => {
    const cfg = stageConfig[d.stage] || { action: NEXT[d.stage]?.label || 'Follow up', color:'#8E8E93', bg:'#F2F2F7' }
    const name = d.contact_name || d.title || 'Unknown'
    const initials = name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()
    const avatarColors = [['#DBEAFE','#1D4ED8'],['#DCF5E7','#15803D'],['#FCE7F3','#9D174D'],['#FEF9C3','#854D0E'],['#EDE9FE','#6D28D9'],['#FEE2E2','#991B1B']]
    const [ab,af] = avatarColors[(d.id||0)%avatarColors.length]
    const notes = d.notes ? d.notes.slice(0,60) + (d.notes.length>60?'…':'') : ''
    const products = d.products || d.product_categories || ''
    return `
      <div class="outreach-row" onclick="openDeal(${d.id})">
        <div class="avatar" style="background:${ab};color:${af};flex-shrink:0;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">${initials}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:#1C1C1E;line-height:1.2">${name}</div>
          ${products ? `<div style="font-size:12px;color:#8E8E93;margin-top:1px">${products}</div>` : ''}
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
            <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${cfg.bg};color:${cfg.color}">${cfg.action}</span>
            ${d.value > 0 ? `<span style="font-size:12px;color:#34C759;font-weight:600">$${fmtMoney(d.value)}</span>` : ''}
          </div>
          ${notes ? `<div style="font-size:11px;color:#AEAEB2;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${notes}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          ${d.contact_mobile || d.contact_phone ? `<a href="tel:${d.contact_mobile||d.contact_phone}" onclick="event.stopPropagation()" style="width:34px;height:34px;background:#F0FDF4;border-radius:50%;display:flex;align-items:center;justify-content:center;text-decoration:none"><i class="fas fa-phone" style="color:#34C759;font-size:13px"></i></a>` : `<i class="fas fa-chevron-right" style="color:#C7C7CC;font-size:13px;margin-top:8px"></i>`}
        </div>
      </div>`
  }).join('')

  return `
    <div style="margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:.06em;padding:12px 16px 6px">
        ${title} <span style="font-weight:500;opacity:.7">${deals.length}</span>
      </div>
      <div class="inset-list" style="margin:0 16px">${rows}</div>
    </div>`
}

// ── LAURA VIEW: operations & backend tasks ────────────
function renderLauraView(deals, dash) {
  const el = document.getElementById('home-ops')
  let html = ''

  // Overdue tasks
  const overdue = dash.overdue_tasks || []
  const dueToday = dash.due_today || []

  if (overdue.length) {
    html += lauraSection('⚠️ Overdue Tasks', overdue.map(t => ({
      label: t.title, sub: t.deal_title || t.contact_name || '',
      color:'#FF3B30', bg:'#FFF1F0', onclick:`openTaskPanel('${encodeURIComponent(JSON.stringify(t))}')`
    })))
  }
  if (dueToday.length) {
    html += lauraSection('📋 Due Today', dueToday.map(t => ({
      label: t.title, sub: t.deal_title || t.contact_name || '',
      color:'#FF9500', bg:'#FFF9EC', onclick:`openTaskPanel('${encodeURIComponent(JSON.stringify(t))}')`
    })))
  }

  // Stage-based Laura actions
  const needsInvoice = deals.filter(d => d.stage === 'estimate_accepted')
  if (needsInvoice.length) {
    html += lauraSection('💰 Send Invoice', needsInvoice.map(d => ({
      label: d.contact_name || d.title, sub: 'Estimate accepted — invoice now',
      color:'#FF3B30', bg:'#FFF1F0', onclick:`openDeal(${d.id})`
    })))
  }

  const needsOrder = deals.filter(d => d.stage === 'invoice_paid')
  if (needsOrder.length) {
    html += lauraSection('🛒 Place Orders', needsOrder.map(d => ({
      label: d.contact_name || d.title, sub: 'Invoice paid — place order with supplier',
      color:'#34C759', bg:'#F0FDF4', onclick:`openDeal(${d.id})`
    })))
  }

  const awaitingConfirm = deals.filter(d => d.stage === 'order_placed')
  if (awaitingConfirm.length) {
    html += lauraSection('📦 Awaiting Supplier Confirmation', awaitingConfirm.map(d => ({
      label: d.contact_name || d.title, sub: 'Order placed — confirm with supplier',
      color:'#32ADE6', bg:'#EFF9FF', onclick:`openDeal(${d.id})`
    })))
  }

  const needsTracking = deals.filter(d => d.stage === 'order_confirmed')
  if (needsTracking.length) {
    html += lauraSection('🚚 Get Shipping ETA', needsTracking.map(d => ({
      label: d.contact_name || d.title, sub: 'Order confirmed — get tracking from supplier',
      color:'#5856D6', bg:'#F5F3FF', onclick:`openDeal(${d.id})`
    })))
  }

  if (!html) {
    html = `<div style="text-align:center;padding:48px 24px">
      <div style="font-size:48px;margin-bottom:12px">✅</div>
      <div style="font-size:18px;font-weight:700;color:#1C1C1E">Operations up to date!</div>
      <div style="font-size:14px;color:#8E8E93;margin-top:6px">No backend tasks right now</div>
    </div>`
  }

  el.innerHTML = html
}

function lauraSection(title, items) {
  const rows = items.map(item => `
    <div class="action-card" onclick="${item.onclick}" style="background:#fff">
      <div style="width:36px;height:36px;border-radius:10px;background:${item.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-circle-dot" style="color:${item.color};font-size:14px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div class="row-main">${item.label}</div>
        <div class="row-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.sub}</div>
      </div>
      <i class="fas fa-chevron-right row-chevron"></i>
    </div>`).join('')
  return `
    <div style="margin-bottom:8px">
      <div style="font-size:12px;font-weight:700;color:#8E8E93;text-transform:uppercase;letter-spacing:.06em;padding:12px 16px 6px">
        ${title} <span style="font-weight:500;opacity:.7">${items.length}</span>
      </div>
      <div class="inset-list" style="margin:0 16px">${rows}</div>
    </div>`
}

// ── PIPELINE PAGE ─────────────────────────────────────
const PIPE_STAGES = [
  { key:'all',              label:'All Active' },
  { key:'lead',             label:'New Leads' },
  { key:'qualified',        label:'Qualified' },
  { key:'estimate_sent',    label:'Estimate Sent' },
  { key:'estimate_accepted',label:'Accepted' },
  { key:'invoice_sent',     label:'Invoice Sent' },
  { key:'invoice_paid',     label:'Invoice Paid' },
  { key:'order_placed',     label:'Order Placed' },
  { key:'order_confirmed',  label:'Confirmed' },
  { key:'shipping',         label:'In Transit' },
  { key:'delivered',        label:'Delivered' },
]
const pipeState = { stage: 'all', counts: {} }

function filterDealsByStage(stage) {
  pipeState.stage = stage
  renderPipeTabs()
  loadDeals()
}

function renderPipeTabs() {
  const el = document.getElementById('pipe-stage-tabs')
  if (!el) return
  el.innerHTML = PIPE_STAGES.map(ps => {
    const active = pipeState.stage === ps.key
    const cnt = ps.key === 'all' ? Object.values(pipeState.counts).reduce((a,b)=>a+b,0) : (pipeState.counts[ps.key]||0)
    const st = ps.key === 'all' ? null : S[ps.key]
    const bg = active ? (st ? st.color : '#1C1C1E') : (st ? st.bg : '#F2F2F7')
    const fg = active ? '#fff' : (st ? st.color : '#636366')
    return `<button onclick="filterDealsByStage('${ps.key}')"
      style="flex-shrink:0;padding:7px 14px;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;background:${bg};color:${fg};white-space:nowrap;transition:all .15s">
      ${ps.label}${cnt > 0 ? ` <span style="opacity:${active?'.85':'.6'}">${cnt}</span>` : ''}
    </button>`
  }).join('')
}

async function loadDeals() {
  const el = document.getElementById('deals-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const params = { status:'active', limit:200 }
    if (pipeState.stage && pipeState.stage !== 'all') params.stage = pipeState.stage
    const { data } = await axios.get(`${API}/deals`, { params })
    const deals = data.deals || []

    // Update counts from this load (when showing all)
    if (pipeState.stage === 'all') {
      pipeState.counts = {}
      deals.forEach(d => { pipeState.counts[d.stage] = (pipeState.counts[d.stage]||0)+1 })
    }
    renderPipeTabs()

    if (!deals.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-handshake"></i><p>No deals in this stage</p></div>`
      return
    }

    // Group by stage when showing all
    if (pipeState.stage === 'all') {
      const stageOrder = ['estimate_accepted','invoice_sent','invoice_paid','order_placed','order_confirmed','shipping','estimate_sent','qualified','lead','delivered']
      const grouped = {}
      deals.forEach(d => { (grouped[d.stage]||(grouped[d.stage]=[])).push(d) })
      let html = ''
      stageOrder.forEach(s => {
        if (!grouped[s]?.length) return
        const st = S[s]
        html += `<div style="margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 16px 6px">
            <span style="width:10px;height:10px;border-radius:50%;background:${st.hex};flex-shrink:0"></span>
            <span style="font-size:12px;font-weight:700;color:#636366;text-transform:uppercase;letter-spacing:.05em">${st.label}</span>
            <span style="font-size:12px;color:#AEAEB2;font-weight:500">${grouped[s].length}</span>
          </div>
          <div class="inset-list" style="margin:0 16px">${grouped[s].map(d => dealRow(d)).join('')}</div>
        </div>`
      })
      el.innerHTML = html
    } else {
      const st = S[pipeState.stage]
      el.innerHTML = `
        <div style="padding:10px 16px 6px;display:flex;align-items:center;gap:8px">
          <span style="width:10px;height:10px;border-radius:50%;background:${st?.hex||'#8E8E93'};flex-shrink:0"></span>
          <span style="font-size:12px;font-weight:700;color:#636366;text-transform:uppercase;letter-spacing:.05em">${st?.label||pipeState.stage}</span>
          <span style="font-size:12px;color:#AEAEB2">${deals.length} people</span>
        </div>
        <div class="inset-list" style="margin:0 16px">${deals.map(d => dealRow(d)).join('')}</div>`
    }
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading deals</p></div>`
  }
}

function dealRow(d) {
  const nx = NEXT[d.stage] || {}
  const name = d.contact_name || d.title || 'Unknown'
  const initials = name.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()
  const avatarColors = [['#DBEAFE','#1D4ED8'],['#DCF5E7','#15803D'],['#FCE7F3','#9D174D'],['#FEF9C3','#854D0E'],['#EDE9FE','#6D28D9'],['#FEE2E2','#991B1B']]
  const [ab,af] = avatarColors[(d.id||0)%avatarColors.length]
  const products = d.products || d.product_categories || ''
  return `
    <div class="outreach-row" onclick="openDeal(${d.id})">
      <div class="avatar" style="background:${ab};color:${af};flex-shrink:0;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;color:#1C1C1E;line-height:1.2">${name}</div>
        ${products ? `<div style="font-size:12px;color:#AEAEB2;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${products}</div>` : ''}
        ${nx.label ? `<div style="font-size:12px;color:${nx.urgent?'#FF3B30':'#8E8E93'};margin-top:3px;display:flex;align-items:center;gap:4px"><i class="fas ${nx.icon}" style="font-size:10px"></i>${nx.label}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        ${d.value > 0 ? `<span style="font-size:13px;font-weight:700;color:#34C759">$${fmtMoney(d.value)}</span>` : ''}
        <i class="fas fa-chevron-right" style="color:#C7C7CC;font-size:12px"></i>
      </div>
    </div>`
}

// Legacy dealCard kept for compatibility
function dealCard(d) { return dealRow(d) }
function filterDeals(f, btn) { pipeState.stage = 'all'; loadDeals() }

// ── CONTACTS PAGE ─────────────────────────────────────
const contactsState = { filter: 'all', search: '' }

function filterContacts(type, btn) {
  contactsState.filter = type
  document.querySelectorAll('#contacts-seg .seg-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  loadContacts(contactsState.search)
}

async function loadContacts(q = '') {
  contactsState.search = q
  const el = document.getElementById('contacts-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const params = { limit: 300 }
    if (q) params.search = q
    if (contactsState.filter !== 'all') params.type = contactsState.filter
    const { data } = await axios.get(`${API}/contacts`, { params })
    const contacts = data.contacts || []

    if (!contacts.length) {
      el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>No contacts found</p></div>`
      return
    }

    // Update count badges if no search
    if (!q) {
      if (contactsState.filter === 'all') {
        const leads = contacts.filter(c => c.type === 'lead' || c.type === 'prospect').length
        const custs = contacts.filter(c => c.type === 'customer').length
        const allEl = document.getElementById('cnt-all')
        const leadsEl = document.getElementById('cnt-leads')
        const custEl = document.getElementById('cnt-cust')
        if (allEl) allEl.textContent = contacts.length
        if (leadsEl) leadsEl.textContent = leads
        if (custEl) custEl.textContent = custs
      }
    }

    const sorted = [...contacts].sort((a,b) => (a.last_name||a.first_name||'').localeCompare(b.last_name||b.first_name||''))
    el.innerHTML = `<div class="inset-list" style="margin:0 16px">` + sorted.map(c => contactRow(c)).join('') + `</div>`
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading</p></div>`
  }
}

function contactRow(c) {
  const init = `${c.first_name?.[0]||''}${c.last_name?.[0]||''}`.toUpperCase() || '?'
  const avatarColors = [['#DBEAFE','#1D4ED8'],['#DCF5E7','#15803D'],['#FCE7F3','#9D174D'],['#FEF9C3','#854D0E'],['#EDE9FE','#6D28D9'],['#FEE2E2','#991B1B']]
  const [bg, fg] = avatarColors[(c.id||0) % avatarColors.length]
  const typeConfig = {
    customer: { label:'Customer', color:'#34C759', bg:'#F0FDF4' },
    lead:     { label:'Lead',     color:'#007AFF', bg:'#EEF4FF' },
    prospect: { label:'Prospect', color:'#5856D6', bg:'#F5F3FF' },
  }
  const tc = typeConfig[c.type] || typeConfig.lead
  const location = [c.city, c.state].filter(Boolean).join(', ')
  const contact = c.mobile || c.phone || c.email || ''
  const notes = c.notes ? c.notes.slice(0,55)+(c.notes.length>55?'…':'') : ''

  return `
    <div class="contact-row" onclick="openContact(${c.id})">
      <div class="avatar" style="background:${bg};color:${fg};flex-shrink:0">${init}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;color:#1C1C1E;line-height:1.2">${c.first_name||''} ${c.last_name||''}</div>
        <div style="font-size:12px;color:#8E8E93;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${location ? location + (contact?' · ':'') : ''}${contact}
        </div>
        ${notes ? `<div style="font-size:11px;color:#AEAEB2;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:${tc.bg};color:${tc.color};white-space:nowrap">${tc.label}</span>
        ${c.last_contacted_at ? `<span style="font-size:10px;color:#C7C7CC">${timeAgo(c.last_contacted_at)}</span>` : ''}
        <i class="fas fa-chevron-right" style="color:#D1D1D6;font-size:11px"></i>
      </div>
    </div>`
}

let _st = null
function debounceSearch(q) {
  clearTimeout(_st)
  _st = setTimeout(() => loadContacts(q), 280)
}

// ── ORDERS PAGE ──────────────────────────────────────
// ── ORDERS PAGE (shipments tab + POs tab) ────────────
function filterOrders(tab, btn) {
  state.ordersFilter = tab
  document.querySelectorAll('#orders-seg .seg-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  if (tab === 'shipments') loadShipments()
  else loadOrders()
}

async function loadShipments() {
  const el = document.getElementById('orders-list')
  el.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/shipments`, { params: { limit:50 } })
    const ships = data.shipments || []
    if (!ships.length) {
      el.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-truck" style="color:#D1D1D6"></i>
          <p>No active shipments</p>
          <p style="font-size:13px;color:#C7C7CC">Add tracking info when an order ships</p>
        </div>`
      return
    }
    el.innerHTML = ships.map(s => shipmentCard(s)).join('')
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading shipments</p></div>`
  }
}

function shipmentCard(s) {
  const SC = {
    in_transit:'#5856D6', out_for_delivery:'#FF9500',
    delivered:'#34C759', picked_up:'#007AFF',
    label_created:'#8E8E93', pending:'#C7C7CC',
    failed:'#FF3B30', returned:'#FF3B30'
  }
  const color = SC[s.status] || '#5856D6'
  const emoji = {
    in_transit:'🚚', out_for_delivery:'📬', delivered:'✅',
    picked_up:'📦', label_created:'🏷️', failed:'⚠️'
  }[s.status] || '📦'
  const isDelivered = s.status === 'delivered'
  return `
    <div class="shipment-card ${isDelivered?'delivered':s.status==='out_for_delivery'?'out_for_delivery':''}" onclick="openShipment(${s.id})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div>
          <div style="font-weight:700;font-size:16px;color:#1C1C1E">${s.carrier} ${emoji}</div>
          <div style="font-size:13px;color:#8E8E93;margin-top:2px;font-family:monospace">${s.tracking_number}</div>
        </div>
        <span style="background:${color}20;color:${color};font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;letter-spacing:.04em;white-space:nowrap">${(s.status||'').replace(/_/g,' ').toUpperCase()}</span>
      </div>
      ${s.deal_title ? `<div style="font-size:13px;color:#3C3C43;font-weight:600;margin-bottom:4px"><i class="fas fa-handshake" style="color:#8E8E93;margin-right:5px"></i>${s.deal_title}</div>` : ''}
      ${s.contact_name ? `<div style="font-size:13px;color:#8E8E93"><i class="fas fa-person" style="margin-right:5px"></i>${s.contact_name}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:.5px solid #E5E5EA">
        ${s.estimated_delivery ? `<span style="font-size:12px;color:#8E8E93">ETA ${s.estimated_delivery}</span>` : `<span></span>`}
        <div style="display:flex;align-items:center;gap:8px">
          ${!s.customer_notified && !isDelivered ? `<span style="font-size:11px;font-weight:700;color:#FF9500;background:#FFF9EC;padding:3px 8px;border-radius:6px">Notify customer</span>` : ''}
          ${s.tracking_url ? `<a href="${s.tracking_url}" target="_blank" onclick="event.stopPropagation()" style="font-size:12px;color:#007AFF;font-weight:600"><i class="fas fa-arrow-up-right-from-square"></i> Track</a>` : ''}
        </div>
      </div>
    </div>
  `
}

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
          ${po.status === 'confirmed' || po.status === 'shipped' ? `
            <button onclick="event.stopPropagation();openTrackingSheet(${po.id},${po.deal_id||'null'},null)" class="btn btn-primary" style="margin-top:12px;font-size:14px;padding:12px">
              <i class="fas fa-truck"></i> ${tracking.length ? 'Update Tracking' : 'Add Tracking Number'}
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
                  <a href="tel:${d.contact_mobile||d.contact_phone}" class="contact-btn" style="background:#F0FDF4"
                     onclick="logAction('call',${d.contact_id},${d.id},'${d.contact_mobile||d.contact_phone}')">
                    <i class="fas fa-phone" style="color:#34C759"></i>
                    <span style="color:#34C759">Call</span>
                  </a>
                  <a href="sms:${d.contact_mobile||d.contact_phone}" class="contact-btn" style="background:#EEF4FF"
                     onclick="logAction('sms',${d.contact_id},${d.id},'${d.contact_mobile||d.contact_phone}')">
                    <i class="fas fa-comment" style="color:#007AFF"></i>
                    <span style="color:#007AFF">Text</span>
                  </a>` : ''}
                ${d.contact_email ? `
                  <a href="mailto:${d.contact_email}" class="contact-btn" style="background:#F5F3FF"
                     onclick="logAction('email',${d.contact_id},${d.id},'${d.contact_email}')">
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
    // Fetch contact + all communications in parallel
    const [contactResp, commsResp] = await Promise.all([
      axios.get(`${API}/contacts/${id}`),
      axios.get(`${API}/communications`, { params: { contact_id: id, limit: 100 } })
    ])
    const c = contactResp.data.contact
    const deals = contactResp.data.deals || []
    const allComms = commsResp.data.communications || []

    const init = `${c.first_name?.[0]||''}${c.last_name?.[0]||''}`
    const typeC = { lead:'#8E8E93', prospect:'#007AFF', customer:'#34C759' }
    const tc = typeC[c.type] || '#8E8E93'
    const tcBg = { lead:'#F2F2F7', prospect:'#EEF4FF', customer:'#F0FDF4' }[c.type] || '#F2F2F7'

    // Gmail search URL for this contact's email
    const gmailSearchUrl = c.email
      ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent('from:' + c.email + ' OR to:' + c.email)}`
      : null

    // Helper: comm type icon + color
    function commIcon(type, dir) {
      const icons = { email:'fa-envelope', sms:'fa-comment', call:'fa-phone', note:'fa-note-sticky', meeting:'fa-calendar-check' }
      const colors = { inbound:'#007AFF', outbound:'#5856D6', internal:'#8E8E93' }
      return { icon: icons[type] || 'fa-message', color: colors[dir] || '#8E8E93' }
    }

    // Group comms: emails first, then calls/sms/notes
    const emailComms = allComms.filter(m => m.type === 'email')
    const otherComms = allComms.filter(m => m.type !== 'email')

    el.innerHTML = `
      <div class="sheet-header">
        <div style="display:flex;align-items:center;gap:14px;flex:1">
          <div style="width:52px;height:52px;border-radius:50%;background:#EEF4FF;color:#007AFF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex-shrink:0">${init}</div>
          <div>
            <div style="font-size:20px;font-weight:700;color:#1C1C1E;letter-spacing:-0.3px">${c.first_name} ${c.last_name}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap">
              <span style="background:${tcBg};color:${tc};font-size:11px;font-weight:700;padding:3px 9px;border-radius:7px;letter-spacing:0.04em">${(c.type||'lead').toUpperCase()}</span>
              ${c.company_name ? `<span style="font-size:13px;color:#8E8E93">${c.company_name}</span>` : ''}
              ${allComms.length ? `<span style="font-size:11px;font-weight:600;color:#8E8E93;background:#F2F2F7;padding:3px 8px;border-radius:6px">${allComms.length} comm${allComms.length!==1?'s':''}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="sheet-close" onclick="closeSheet('sh-contact')" style="flex-shrink:0;align-self:flex-start"><i class="fas fa-xmark"></i></button>
      </div>

      <div class="sheet-body">

        <!-- ── ACTION BUTTONS ── -->
        <div class="contact-actions" style="margin-bottom:16px">
          ${c.mobile||c.phone ? `
            <a href="tel:${c.mobile||c.phone}" class="contact-btn" style="background:#F0FDF4"
               onclick="logAction('call',${c.id},null,'${c.mobile||c.phone}')">
              <i class="fas fa-phone" style="color:#34C759"></i>
              <span style="color:#34C759">Call</span>
            </a>
            <a href="sms:${c.mobile||c.phone}" class="contact-btn" style="background:#EEF4FF"
               onclick="logAction('sms',${c.id},null,'${c.mobile||c.phone}')">
              <i class="fas fa-comment" style="color:#007AFF"></i>
              <span style="color:#007AFF">Text</span>
            </a>
          ` : '<div></div><div></div>'}
          ${c.email ? `
            <a href="mailto:${c.email}" class="contact-btn" style="background:#F5F3FF"
               onclick="logAction('email',${c.id},null,'${c.email}')">
              <i class="fas fa-envelope" style="color:#5856D6"></i>
              <span style="color:#5856D6">Email</span>
            </a>
          ` : '<div></div>'}
        </div>

        <!-- ── CONTACT INFO ── -->
        <div class="info-block" style="margin-bottom:16px">
          ${c.email ? `
            <div class="info-row" style="cursor:pointer" onclick="navigator.clipboard?.writeText('${c.email}');toast('Email copied!','success')">
              <i class="fas fa-envelope"></i>
              <span style="flex:1">${c.email}</span>
              <i class="fas fa-copy" style="color:#C7C7CC;font-size:12px"></i>
            </div>` : ''}
          ${c.mobile||c.phone ? `
            <div class="info-row" style="cursor:pointer" onclick="navigator.clipboard?.writeText('${c.mobile||c.phone}');toast('Phone copied!','success')">
              <i class="fas fa-phone"></i>
              <span style="flex:1">${c.mobile||c.phone}</span>
              <i class="fas fa-copy" style="color:#C7C7CC;font-size:12px"></i>
            </div>` : ''}
          ${c.city||c.state ? `<div class="info-row"><i class="fas fa-location-dot"></i><span>${[c.city,c.state].filter(Boolean).join(', ')}</span></div>` : ''}
          ${c.last_contacted_at ? `<div class="info-row"><i class="fas fa-clock"></i><span style="color:#8E8E93">Last contact: ${timeAgo(c.last_contacted_at)}</span></div>` : ''}
        </div>

        <!-- ── GMAIL DEEP LINK ── -->
        ${gmailSearchUrl ? `
          <a href="${gmailSearchUrl}" target="_blank"
             style="display:flex;align-items:center;gap:10px;padding:13px 16px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,0.07);margin-bottom:16px;text-decoration:none;border:1.5px solid #E5E5EA">
            <span style="width:36px;height:36px;background:#FEE2E2;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="#EA4335" stroke-width="1.5"/>
                <path d="M2 6l10 7 10-7" stroke="#EA4335" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px;color:#1C1C1E">View in Gmail</div>
              <div style="font-size:12px;color:#8E8E93">Search all emails with ${c.first_name}</div>
            </div>
            <i class="fas fa-arrow-up-right-from-square" style="color:#8E8E93;font-size:13px"></i>
          </a>` : ''}

        <!-- ── DEALS ── -->
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

        <!-- ── ALL COMMUNICATIONS ── -->
        ${allComms.length ? `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 8px">
            <div class="section-head" style="padding:0">Communications (${allComms.length})</div>
            <button onclick="openLogComm(null,${c.id},'email')" style="font-size:13px;font-weight:600;color:#007AFF;background:none;border:none;cursor:pointer;padding:0">+ Log</button>
          </div>

          <!-- Email tab / All tab toggle -->
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <button id="ctab-all-${c.id}" onclick="showContactComms('all',${c.id})" style="padding:5px 14px;border-radius:100px;border:1.5px solid #007AFF;background:#EEF4FF;color:#007AFF;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">All</button>
            <button id="ctab-email-${c.id}" onclick="showContactComms('email',${c.id})" style="padding:5px 14px;border-radius:100px;border:1.5px solid #E5E5EA;background:#fff;color:#636366;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
              <i class="fas fa-envelope" style="margin-right:4px"></i>Email (${emailComms.length})
            </button>
            <button id="ctab-calls-${c.id}" onclick="showContactComms('calls',${c.id})" style="padding:5px 14px;border-radius:100px;border:1.5px solid #E5E5EA;background:#fff;color:#636366;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
              <i class="fas fa-phone" style="margin-right:4px"></i>Calls (${otherComms.filter(x=>x.type==='call').length})
            </button>
          </div>

          <!-- Comm list: all -->
          <div id="commlist-all-${c.id}" class="info-block" style="margin-bottom:16px">
            ${allComms.map(m => {
              const ci = commIcon(m.type, m.direction)
              const dirBadge = m.direction === 'inbound'
                ? `<span style="font-size:10px;font-weight:700;color:#007AFF;background:#EEF4FF;padding:2px 6px;border-radius:5px">IN</span>`
                : m.direction === 'outbound'
                ? `<span style="font-size:10px;font-weight:700;color:#5856D6;background:#F5F3FF;padding:2px 6px;border-radius:5px">OUT</span>`
                : `<span style="font-size:10px;font-weight:700;color:#8E8E93;background:#F2F2F7;padding:2px 6px;border-radius:5px">NOTE</span>`
              const gmailLink = m.gmail_thread_id
                ? `<a href="https://mail.google.com/mail/u/0/#inbox/${m.gmail_thread_id}" target="_blank" onclick="event.stopPropagation()" style="font-size:12px;color:#EA4335;font-weight:600;white-space:nowrap"><i class="fas fa-arrow-up-right-from-square"></i> Gmail</a>`
                : m.type === 'email' && c.email
                ? `<a href="https://mail.google.com/mail/u/0/#search/${encodeURIComponent('from:'+c.email+' OR to:'+c.email)}" target="_blank" onclick="event.stopPropagation()" style="font-size:12px;color:#EA4335;font-weight:600;white-space:nowrap"><i class="fas fa-arrow-up-right-from-square"></i> Gmail</a>`
                : ''
              return `
                <div class="info-row" style="align-items:flex-start;padding:13px 16px;gap:12px">
                  <div style="width:34px;height:34px;border-radius:10px;background:${ci.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
                    <i class="fas ${ci.icon}" style="font-size:14px;color:${ci.color}"></i>
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
                      ${dirBadge}
                      <span style="font-size:13px;font-weight:700;color:#1C1C1E;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${m.subject || (m.type==='call'?'Phone call':m.type==='sms'?'Text message':'Internal note')}</span>
                    </div>
                    ${m.body ? `<div style="font-size:12px;color:#8E8E93;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">${m.body.replace(/<[^>]+>/g,'').substring(0,80)}${m.body.length>80?'…':''}</div>` : ''}
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
                      <span style="font-size:11px;color:#C7C7CC">${timeAgo(m.created_at)}${m.deal_title?' · '+m.deal_title:''}</span>
                      ${gmailLink}
                    </div>
                  </div>
                </div>`
            }).join('')}
          </div>

          <!-- Comm list: email only -->
          <div id="commlist-email-${c.id}" class="info-block" style="margin-bottom:16px;display:none">
            ${emailComms.length ? emailComms.map(m => {
              const gmailLink = m.gmail_thread_id
                ? `<a href="https://mail.google.com/mail/u/0/#inbox/${m.gmail_thread_id}" target="_blank" onclick="event.stopPropagation()" style="font-size:13px;color:#EA4335;font-weight:600;display:flex;align-items:center;gap:5px"><i class="fas fa-arrow-up-right-from-square"></i> Open in Gmail</a>`
                : c.email
                ? `<a href="https://mail.google.com/mail/u/0/#search/${encodeURIComponent('subject:'+encodeURIComponent(m.subject||''))}" target="_blank" onclick="event.stopPropagation()" style="font-size:13px;color:#EA4335;font-weight:600;display:flex;align-items:center;gap:5px"><i class="fas fa-arrow-up-right-from-square"></i> Search Gmail</a>`
                : ''
              const dirColor = m.direction==='inbound'?'#007AFF':'#5856D6'
              return `
                <div style="padding:14px 16px;border-bottom:.5px solid #E5E5EA">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
                    <div style="flex:1;min-width:0">
                      <div style="font-size:14px;font-weight:700;color:#1C1C1E;margin-bottom:2px;line-height:1.3">${m.subject||'(no subject)'}</div>
                      <div style="font-size:12px;color:${dirColor};font-weight:600">${m.direction==='inbound'?'← Received':'→ Sent'} · ${timeAgo(m.created_at)}</div>
                    </div>
                    <span style="font-size:10px;font-weight:700;color:${dirColor};background:${dirColor}15;padding:3px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0">${m.direction==='inbound'?'INBOUND':'OUTBOUND'}</span>
                  </div>
                  ${m.body ? `<div style="font-size:13px;color:#636366;line-height:1.5;margin-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${m.body.replace(/<[^>]+>/g,'').trim()}</div>` : ''}
                  ${m.deal_title ? `<div style="font-size:12px;color:#8E8E93;margin-bottom:8px"><i class="fas fa-handshake" style="margin-right:4px"></i>${m.deal_title}</div>` : ''}
                  ${gmailLink}
                </div>`
            }).join('') : `<div style="padding:20px;text-align:center;color:#8E8E93;font-size:14px">No emails logged yet</div>`}
          </div>

          <!-- Comm list: calls only -->
          <div id="commlist-calls-${c.id}" class="info-block" style="margin-bottom:16px;display:none">
            ${otherComms.filter(x=>x.type==='call').length ? otherComms.filter(x=>x.type==='call').map(m => `
              <div class="info-row" style="align-items:flex-start;padding:13px 16px">
                <div style="width:34px;height:34px;border-radius:10px;background:#F0FDF4;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <i class="fas fa-phone" style="font-size:14px;color:#34C759"></i>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;font-weight:600;color:#1C1C1E">${m.direction==='inbound'?'Incoming call':'Outbound call'}</div>
                  ${m.body ? `<div style="font-size:13px;color:#636366;margin-top:2px">${m.body.substring(0,120)}</div>` : ''}
                  <div style="font-size:12px;color:#C7C7CC;margin-top:4px">${timeAgo(m.created_at)}${m.deal_title?' · '+m.deal_title:''}</div>
                </div>
              </div>`).join('') : `<div style="padding:20px;text-align:center;color:#8E8E93;font-size:14px">No calls logged yet</div>`}
          </div>

        ` : `
          <!-- No comms yet -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 8px">
            <div class="section-head" style="padding:0">Communications</div>
            <button onclick="openLogComm(null,${c.id},'email')" style="font-size:13px;font-weight:600;color:#007AFF;background:none;border:none;cursor:pointer;padding:0">+ Log</button>
          </div>
          ${gmailSearchUrl ? `
            <a href="${gmailSearchUrl}" target="_blank"
               style="display:flex;align-items:center;gap:10px;padding:13px 16px;background:#FEF2F2;border-radius:14px;margin-bottom:16px;text-decoration:none;border:1px solid #FECACA">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="#EA4335" stroke-width="1.5"/><path d="M2 6l10 7 10-7" stroke="#EA4335" stroke-width="1.5" stroke-linecap="round"/></svg>
              <div style="flex:1">
                <div style="font-weight:700;font-size:14px;color:#DC2626">Search Gmail</div>
                <div style="font-size:12px;color:#EF4444">Find existing emails with ${c.first_name}</div>
              </div>
              <i class="fas fa-arrow-up-right-from-square" style="color:#EA4335;font-size:13px"></i>
            </a>` : ''}
          <div style="background:#F9F9F9;border-radius:14px;padding:20px;text-align:center;margin-bottom:16px">
            <div style="font-size:32px;margin-bottom:8px">💬</div>
            <div style="font-size:14px;font-weight:600;color:#3C3C43">No communications yet</div>
            <div style="font-size:13px;color:#8E8E93;margin-top:4px">Log a call, email, or note to start tracking</div>
          </div>
        `}

        ${c.notes ? `<div style="background:#FFFBEC;border-radius:14px;padding:14px;font-size:14px;color:#3C3C43;margin-bottom:16px;border:1px solid #FEF3C7"><i class="fas fa-note-sticky" style="color:#FF9500;margin-right:8px"></i>${c.notes}</div>` : ''}

        <div style="display:flex;flex-direction:column;gap:10px">
          <button onclick="openLogComm(null,${c.id},'email')" class="btn btn-purple">
            <i class="fas fa-comment-dots"></i> Log Communication
          </button>
          <button onclick="openAddDeal(${c.id});closeSheet('sh-contact')" class="btn btn-primary">
            <i class="fas fa-handshake"></i> New Deal for ${c.first_name}
          </button>
        </div>

      </div>
    `
  } catch(err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading contact</p></div>`
  }
}

// ── CONTACT COMMS TAB TOGGLE ─────────────────────────
function showContactComms(tab, contactId) {
  // Hide all
  const all   = document.getElementById(`commlist-all-${contactId}`)
  const email = document.getElementById(`commlist-email-${contactId}`)
  const calls = document.getElementById(`commlist-calls-${contactId}`)
  if (all)   all.style.display   = 'none'
  if (email) email.style.display = 'none'
  if (calls) calls.style.display = 'none'

  // Show selected
  const target = document.getElementById(`commlist-${tab}-${contactId}`)
  if (target) target.style.display = 'block'

  // Update tab styles
  const tabs = ['all','email','calls']
  tabs.forEach(t => {
    const btn = document.getElementById(`ctab-${t}-${contactId}`)
    if (!btn) return
    if (t === tab) {
      btn.style.borderColor = '#007AFF'
      btn.style.background  = '#EEF4FF'
      btn.style.color       = '#007AFF'
    } else {
      btn.style.borderColor = '#E5E5EA'
      btn.style.background  = '#fff'
      btn.style.color       = '#636366'
    }
  })
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
          ${po.status==='confirmed'||po.status==='shipped' ? `<button onclick="closeSheet('sh-panel');openTrackingSheet(${po.id},${po.deal_id||'null'},null)" class="btn btn-primary"><i class="fas fa-truck"></i> ${po.status==='shipped'?'View / Update Tracking':'Add Tracking Number'}</button>` : ''}
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
    const { data } = await axios.patch(`${API}/deals/${dealId}/stage`, { stage })
    const taskMsg = data.tasks_created > 0 ? ` · ${data.tasks_created} task${data.tasks_created>1?'s':''} created` : ''
    toast(`Moved to: ${S[stage]?.label}${taskMsg}`, 'success')
    openDeal(dealId)
    if (state.page === 'home') loadHome()
    if (state.page === 'deals') loadDeals()
    // Auto-prompt tracking entry when stage → shipping
    if (stage === 'shipping') {
      setTimeout(() => {
        closeSheet('sh-deal')
        setTimeout(() => openTrackingSheet(null, dealId, null), 350)
      }, 600)
    }
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

// ── AUTO-LOG CONTACT ACTIONS ─────────────────────────
// Call this silently whenever user taps Call / Text / Email
function logAction(type, contactId, dealId, phoneOrEmail) {
  axios.post(`${API}/communications/log-action`, {
    type,
    contact_id: contactId || null,
    deal_id:    dealId    || null,
    phone:      type !== 'email' ? (phoneOrEmail || null) : null,
    email:      type === 'email' ? (phoneOrEmail || null) : null,
  }).catch(() => {})  // fire-and-forget, never block the user
}

// ── ORDERS ───────────────────────────────────────────
async function requestQuote(poId) {
  try {
    const { data } = await axios.post(`${API}/purchase-orders/${poId}/request-quote`)
    toast(data.message || 'Quote requested!', 'success')
    loadOrders()
  } catch { toast('Error requesting quote', 'error') }
}

// ── TRACKING SYSTEM ─────────────────────────────────
function openTrackingSheet(poId, dealId, contactId) {
  // Reset form
  document.getElementById('form-tracking').reset()
  document.getElementById('tracking-saved-actions').style.display = 'none'
  document.getElementById('form-tracking').style.display = 'block'
  document.getElementById('tracking-url-preview').style.display = 'none'
  document.querySelectorAll('.carrier-chip').forEach(c => {
    c.style.borderColor = '#E5E5EA'; c.style.background = '#F9F9F9'; c.style.color = '#1C1C1E'
  })

  // Set context
  document.getElementById('tracking-po-id').value = poId || ''
  document.getElementById('tracking-deal-id').value = dealId || ''
  document.getElementById('tracking-contact-id').value = contactId || ''
  trackingState.poId = poId; trackingState.dealId = dealId; trackingState.contactId = contactId

  const sub = dealId && !poId ? `Deal #${dealId} — Enter tracking when order ships` :
              poId ? `PO tracking info` : 'Enter shipment tracking details'
  document.getElementById('tracking-entry-subtitle').textContent = sub

  openSheet('sh-tracking-entry')
}

function selectCarrier(name) {
  document.getElementById('tracking-carrier').value = name
  document.querySelectorAll('.carrier-chip').forEach(c => {
    const isThis = c.textContent.trim().toLowerCase().includes(name.toLowerCase().split(' ')[0].toLowerCase())
    c.style.borderColor = isThis ? '#5856D6' : '#E5E5EA'
    c.style.background  = isThis ? '#F5F3FF' : '#F9F9F9'
    c.style.color       = isThis ? '#5856D6' : '#1C1C1E'
  })
  // Update URL preview
  updateTrackingPreview()
}

function updateTrackingPreview() {
  const carrier  = document.getElementById('tracking-carrier').value
  const tracking = document.getElementById('tracking-number').value
  const custom   = document.getElementById('tracking-url').value
  if (!carrier || !tracking) { document.getElementById('tracking-url-preview').style.display = 'none'; return }
  const url = custom || buildTrackingUrl(carrier, tracking)
  document.getElementById('tracking-url-preview').style.display = 'block'
  document.getElementById('tracking-url-preview-text').textContent = url
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tracking-number')?.addEventListener('input', updateTrackingPreview)
  document.getElementById('tracking-url')?.addEventListener('input', updateTrackingPreview)
})

function buildTrackingUrl(carrier, num) {
  const c = carrier.toLowerCase()
  if (c.includes('ups'))   return `https://www.ups.com/track?tracknum=${num}`
  if (c.includes('fedex')) return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${num}`
  if (c.includes('usps'))  return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${num}`
  if (c.includes('estes')) return `https://www.estes-express.com/myestes/shipment-tracking/?search=${num}`
  if (c.includes('xpo'))   return `https://track.xpo.com/tracking?number=${num}`
  return `https://www.google.com/search?q=${encodeURIComponent(carrier)}+tracking+${num}`
}

async function submitTracking(e) {
  e.preventDefault()
  const fd = new FormData(e.target)
  const carrier        = fd.get('carrier')?.trim()
  const trackingNumber = fd.get('tracking_number')?.trim()
  const trackingUrl    = fd.get('tracking_url')?.trim() || ''
  const estimatedDel   = fd.get('estimated_delivery') || ''
  const notes          = fd.get('notes') || ''

  if (!carrier || !trackingNumber) { toast('Carrier and tracking number required', 'error'); return }

  const btn = e.target.querySelector('button[type=submit]')
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'

  try {
    let result
    if (trackingState.poId) {
      // Use PO endpoint
      const { data } = await axios.post(`${API}/purchase-orders/${trackingState.poId}/add-tracking`, {
        carrier, tracking_number: trackingNumber,
        tracking_url: trackingUrl || undefined,
        contact_id: trackingState.contactId || undefined,
        estimated_delivery: estimatedDel || undefined,
        notes: notes || undefined
      })
      trackingState.shipmentId = data.shipment_id
      trackingState.trackingUrl = data.tracking_url
    } else {
      // Create shipment directly
      const { data } = await axios.post(`${API}/shipments`, {
        deal_id: trackingState.dealId || undefined,
        contact_id: trackingState.contactId || undefined,
        carrier, tracking_number: trackingNumber,
        tracking_url: trackingUrl || undefined,
        estimated_delivery: estimatedDel || undefined
      })
      trackingState.shipmentId = data.shipment?.id
      trackingState.trackingUrl = data.tracking_url
    }
    trackingState.carrier = carrier
    trackingState.trackingNumber = trackingNumber

    // Show success + actions
    document.getElementById('form-tracking').style.display = 'none'
    const actEl = document.getElementById('tracking-saved-actions')
    actEl.style.display = 'flex'
    document.getElementById('tracking-saved-msg').textContent =
      `${carrier} · ${trackingNumber}${estimatedDel ? ' · ETA ' + estimatedDel : ''}`

    toast('📦 Tracking saved! Deal moved to In Transit.', 'success')
    if (state.page === 'home') loadHome()
    if (state.page === 'deals') loadDeals()
    if (state.page === 'orders') { state.ordersFilter === 'shipments' ? loadShipments() : loadOrders() }
  } catch(err) {
    toast('Error saving tracking info', 'error')
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-truck"></i> Save Tracking Info'
  }
}

async function notifyCustomerTracking() {
  if (!trackingState.shipmentId) return
  try {
    await axios.patch(`${API}/shipments/${trackingState.shipmentId}/notify-customer`)
    toast('✅ Customer marked as notified!', 'success')
  } catch { toast('Error updating notification status', 'error') }
}

function openAIDraftFromTracking() {
  closeSheet('sh-tracking-entry')
  setTimeout(() => {
    aiDraftState.dealId = trackingState.dealId
    aiDraftState.contactId = trackingState.contactId
    aiDraftState.intent = `Share the shipment tracking information so the customer can monitor their delivery. Carrier: ${trackingState.carrier}, Tracking number: ${trackingState.trackingNumber}, Tracking link: ${trackingState.trackingUrl}`
    document.querySelectorAll('.ai-intent-btn').forEach(b => b.classList.remove('selected'))
    const shareBtn = document.querySelector('.ai-intent-btn:nth-child(5)')
    if (shareBtn) shareBtn.classList.add('selected')
    document.getElementById('ai-custom-intent').value = aiDraftState.intent
    openSheet('sh-ai-draft')
    openLogComm(trackingState.dealId, trackingState.contactId, 'email')
  }, 350)
}

async function copyTrackingLink() {
  const url = trackingState.trackingUrl
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    toast('Tracking link copied!', 'success')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = url; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta)
    toast('Copied!', 'success')
  }
}

// ── SHIPMENT DETAIL ──────────────────────────────────
async function openShipment(id) {
  openSheet('sh-shipment-detail')
  const el = document.getElementById('sh-shipment-detail-body')
  el.innerHTML = `<div class="loading" style="padding:80px"><i class="fas fa-spinner fa-spin"></i></div>`
  try {
    const { data } = await axios.get(`${API}/shipments/${id}`)
    const s = data.shipment
    const history = s.tracking_history || []
    const SC = { in_transit:'#5856D6', out_for_delivery:'#FF9500', delivered:'#34C759', picked_up:'#007AFF', failed:'#FF3B30' }
    const color = SC[s.status] || '#5856D6'
    const isDelivered = s.status === 'delivered'

    const statusEmoji = { in_transit:'🚚', out_for_delivery:'📬', delivered:'✅', picked_up:'📦', label_created:'🏷️', failed:'⚠️' }[s.status] || '📦'

    el.innerHTML = `
      <div class="sheet-header" style="margin-bottom:0">
        <div style="flex:1;padding-right:8px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <div class="track-status-ring" style="background:${color}20">
              <span style="font-size:26px">${statusEmoji}</span>
            </div>
            <div>
              <div style="font-size:20px;font-weight:700;color:#1C1C1E">${s.carrier}</div>
              <div style="font-size:13px;color:#8E8E93;font-family:monospace">${s.tracking_number}</div>
            </div>
          </div>
          <span style="background:${color}20;color:${color};font-size:11px;font-weight:700;padding:4px 12px;border-radius:8px;letter-spacing:.04em">${(s.status||'').replace(/_/g,' ').toUpperCase()}</span>
        </div>
        <button class="sheet-close" onclick="closeSheet('sh-shipment-detail')" style="flex-shrink:0;align-self:flex-start"><i class="fas fa-xmark"></i></button>
      </div>

      <div class="sheet-body" style="padding-bottom:28px">

        <!-- Info block -->
        <div class="info-block" style="margin-bottom:14px">
          ${s.deal_title ? `<div class="info-row"><i class="fas fa-handshake"></i><span style="font-weight:600">${s.deal_title}</span></div>` : ''}
          ${s.contact_name ? `<div class="info-row"><i class="fas fa-person"></i><span>${s.contact_name}</span></div>` : ''}
          ${s.estimated_delivery ? `<div class="info-row"><i class="fas fa-calendar-check"></i><span>ETA: ${s.estimated_delivery}</span></div>` : ''}
          ${s.actual_delivery ? `<div class="info-row"><i class="fas fa-circle-check" style="color:#34C759"></i><span style="font-weight:600;color:#34C759">Delivered: ${s.actual_delivery}</span></div>` : ''}
          <div class="info-row">
            <i class="fas fa-bell" style="color:${s.customer_notified?'#34C759':'#FF9500'}"></i>
            <span style="color:${s.customer_notified?'#34C759':'#FF9500'};font-weight:600">${s.customer_notified?'Customer notified ✓':'Customer NOT yet notified'}</span>
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
          ${s.tracking_url ? `
            <a href="${s.tracking_url}" target="_blank" class="btn btn-primary">
              <i class="fas fa-arrow-up-right-from-square"></i> Open Live Tracking
            </a>` : ''}
          ${!s.customer_notified && !isDelivered ? `
            <button onclick="markShipmentNotified(${s.id})" class="btn btn-green">
              <i class="fas fa-share"></i> Mark Customer as Notified
            </button>` : ''}
          ${isDelivered ? '' : `
            <button onclick="markDelivered(${s.id})" class="btn btn-gray" style="color:#34C759">
              <i class="fas fa-circle-check"></i> Mark as Delivered
            </button>
            <button onclick="markOutForDelivery(${s.id})" class="btn btn-gray" style="color:#FF9500">
              <i class="fas fa-truck-fast"></i> Mark Out for Delivery
            </button>`}
        </div>

        <!-- Tracking Timeline -->
        <div class="section-head" style="padding:0 0 10px">Tracking Timeline</div>
        ${history.length ? `
          <div class="track-timeline">
            ${history.map((evt, i) => `
              <div class="track-event ${i===0?'active':''}">
                <div class="track-event-time">${new Date(evt.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                <div class="track-event-desc">${evt.description || evt.status}</div>
                ${evt.location ? `<div class="track-event-loc"><i class="fas fa-location-dot" style="margin-right:4px"></i>${evt.location}</div>` : ''}
              </div>`).join('')}
          </div>` : `
          <div style="color:#8E8E93;font-size:14px;padding:16px">No tracking updates yet</div>`}

        <!-- Manual status update -->
        <div style="margin-top:20px;padding-top:16px;border-top:.5px solid #E5E5EA">
          <div class="section-head" style="padding:0 0 10px">Manual Status Update</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${['in_transit','picked_up','out_for_delivery','delivered','failed'].map(st => `
              <button onclick="updateShipmentStatus(${s.id},'${st}')" class="btn btn-gray" style="font-size:13px;padding:12px;${s.status===st?'background:#E5E5EA;font-weight:800':''}">${{in_transit:'🚚 In Transit',picked_up:'📦 Picked Up',out_for_delivery:'📬 Out for Delivery',delivered:'✅ Delivered',failed:'⚠️ Failed'}[st]}</button>`).join('')}
          </div>
        </div>

      </div>
    `
  } catch {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i><p>Error loading shipment</p></div>`
  }
}

async function markDelivered(shipmentId) {
  if (!confirm('Mark this shipment as delivered? This will update the deal to Delivered and create follow-up tasks.')) return
  try {
    const { data } = await axios.patch(`${API}/shipments/${shipmentId}/status`, { status:'delivered' })
    toast(`🎉 Delivered! ${data.tasks_created} follow-up tasks created.`, 'success')
    closeSheet('sh-shipment-detail')
    if (state.page === 'orders') state.ordersFilter === 'shipments' ? loadShipments() : loadOrders()
    if (state.page === 'home') loadHome()
  } catch { toast('Error updating shipment', 'error') }
}

async function markOutForDelivery(shipmentId) {
  try {
    await axios.patch(`${API}/shipments/${shipmentId}/status`, { status:'out_for_delivery', description:'Package out for delivery today' })
    toast('📬 Out for delivery!', 'success')
    openShipment(shipmentId)
    if (state.page === 'home') loadHome()
  } catch { toast('Error updating shipment', 'error') }
}

async function updateShipmentStatus(shipmentId, status) {
  try {
    const { data } = await axios.patch(`${API}/shipments/${shipmentId}/status`, { status })
    if (data.tasks_created > 0) toast(`Status updated · ${data.tasks_created} follow-up tasks created`, 'success')
    else toast('Status updated', 'success')
    openShipment(shipmentId)
    if (state.page === 'home') loadHome()
    if (state.page === 'orders') state.ordersFilter === 'shipments' ? loadShipments() : loadOrders()
  } catch { toast('Error updating status', 'error') }
}

async function markShipmentNotified(shipmentId) {
  try {
    await axios.patch(`${API}/shipments/${shipmentId}/notify-customer`)
    toast('✅ Customer marked as notified!', 'success')
    openShipment(shipmentId)
  } catch { toast('Error', 'error') }
}

// legacy alias for PO cards that still call addTracking
function addTracking(poId) { openTrackingSheet(poId, null, null) }

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
