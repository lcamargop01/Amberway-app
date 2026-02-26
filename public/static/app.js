// Amberway Equine CRM - Frontend JavaScript
// Complete SPA with full CRM functionality

const API = '/api'
let state = {
  currentPage: 'dashboard',
  contacts: [],
  deals: [],
  tasks: [],
  companies: [],
  suppliers: [],
  products: [],
  notifications: [],
  pipelineChart: null,
  revenueChart: null,
  currentDeal: null,
  commType: 'email',
  poLineItems: []
}

const STAGE_LABELS = {
  lead: 'New Lead', qualified: 'Qualified', proposal_sent: 'Proposal Sent',
  estimate_sent: 'Estimate Sent', estimate_accepted: 'Estimate Accepted',
  invoice_sent: 'Invoice Sent', invoice_paid: 'Invoice Paid',
  order_placed: 'Order Placed', order_confirmed: 'Order Confirmed',
  shipping: 'Shipping', delivered: 'Delivered', completed: 'Completed',
  lost: 'Lost', on_hold: 'On Hold'
}

const STAGE_COLORS = {
  lead: '#6B7280', qualified: '#3B82F6', proposal_sent: '#8B5CF6',
  estimate_sent: '#F59E0B', estimate_accepted: '#10B981', invoice_sent: '#06B6D4',
  invoice_paid: '#22C55E', order_placed: '#84CC16', order_confirmed: '#14B8A6',
  shipping: '#6366F1', delivered: '#059669', completed: '#16A34A',
  lost: '#EF4444', on_hold: '#9CA3AF'
}

const PRIORITY_COLORS = { low: '#94a3b8', medium: '#f59e0b', high: '#ef4444', urgent: '#dc2626' }
const COMM_ICONS = { email: 'fa-envelope', sms: 'fa-sms', call: 'fa-phone', note: 'fa-sticky-note', meeting: 'fa-calendar' }
const PO_STATUS_COLORS = {
  draft: '#94a3b8', quote_requested: '#f59e0b', quote_received: '#3b82f6',
  approved: '#8b5cf6', submitted: '#06b6d4', confirmed: '#10b981',
  in_production: '#84cc16', shipped: '#6366f1', partially_received: '#f97316',
  received: '#22c55e', cancelled: '#ef4444'
}

// ============================================================
// CORE NAVIGATION
// ============================================================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'))
  
  const pageEl = document.getElementById(`page-${page}`)
  if (pageEl) pageEl.classList.add('active')
  
  const links = document.querySelectorAll('.sidebar-link')
  links.forEach(l => {
    if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(`'${page}'`)) {
      l.classList.add('active')
    }
  })
  
  state.currentPage = page
  loadPageData(page)
}

function loadPageData(page) {
  switch(page) {
    case 'dashboard': loadDashboard(); break
    case 'pipeline': loadPipeline(); break
    case 'contacts': loadContacts(); break
    case 'companies': loadCompanies(); break
    case 'tasks': loadTasks('pending'); break
    case 'communications': loadCommunications(); break
    case 'estimates': loadEstimates(); break
    case 'invoices': loadInvoices(); break
    case 'purchase-orders': loadPurchaseOrders(); break
    case 'shipments': loadShipments(); break
    case 'settings': loadSettings(); break
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const { data } = await axios.get(`${API}/dashboard`)
    renderKPIs(data.kpis)
    renderPipelineChart(data.deals_by_stage)
    renderRevenueChart(data.revenue_trend)
    renderDashTasks(data.overdue_tasks, data.due_today)
    renderDashActivity(data.recent_activity)
    renderDashPOs(data.active_pos)
    renderDashNotifications(data.notifications)
    updateNotifBadge(data.kpis.unread_notifications?.count || 0)
    updateTasksBadge(data.overdue_tasks?.length || 0)
  } catch(e) {
    console.error('Dashboard error:', e)
  }
}

function renderKPIs(kpis) {
  const el = document.getElementById('kpi-cards')
  if (!kpis) return
  
  const cards = [
    { label: 'Active Deals', value: kpis.active_deals?.count || 0, sub: `$${fmtNum(kpis.active_deals?.total || 0)} pipeline`, icon: 'fa-handshake', color: 'indigo', onclick: "showPage('pipeline')" },
    { label: 'Total Contacts', value: kpis.total_contacts?.count || 0, sub: 'Customers & leads', icon: 'fa-users', color: 'blue', onclick: "showPage('contacts')" },
    { label: 'Open Invoices', value: kpis.open_invoices?.count || 0, sub: `$${fmtNum(kpis.open_invoices?.total || 0)} outstanding`, icon: 'fa-dollar-sign', color: 'green', onclick: "showPage('invoices')" },
    { label: 'Active Orders', value: kpis.pending_pos?.count || 0, sub: 'Purchase orders', icon: 'fa-shipping-fast', color: 'orange', onclick: "showPage('purchase-orders')" }
  ]
  
  const colorMap = { indigo: '#6366f1', blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b' }
  el.innerHTML = cards.map(c => `
    <div class="card cursor-pointer hover:shadow-md transition-shadow" onclick="${c.onclick}">
      <div class="flex items-center justify-between mb-2">
        <div style="width:40px;height:40px;background:${colorMap[c.color]}20;border-radius:10px;display:flex;align-items:center;justify-content:center">
          <i class="fas ${c.icon}" style="color:${colorMap[c.color]}"></i>
        </div>
      </div>
      <div class="text-3xl font-bold text-slate-800">${c.value}</div>
      <div class="text-sm text-slate-500 mt-1">${c.label}</div>
      <div class="text-xs text-slate-400 mt-1">${c.sub}</div>
    </div>
  `).join('')
}

function renderPipelineChart(data) {
  const ctx = document.getElementById('pipelineChart')
  if (!ctx) return
  if (state.pipelineChart) state.pipelineChart.destroy()
  
  const labels = (data || []).map(d => STAGE_LABELS[d.stage] || d.stage)
  const values = (data || []).map(d => d.count)
  const colors = (data || []).map(d => STAGE_COLORS[d.stage] || '#94a3b8')
  
  state.pipelineChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { font: { size: 11 } } } }
    }
  })
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('revenueChart')
  if (!ctx) return
  if (state.revenueChart) state.revenueChart.destroy()
  
  const sorted = (data || []).reverse()
  const labels = sorted.map(d => d.month || '')
  const values = sorted.map(d => d.revenue || 0)
  
  state.revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue', data: values,
        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => '$' + fmtNum(v) } } }
    }
  })
}

function renderDashTasks(overdue, dueToday) {
  const el = document.getElementById('dash-tasks')
  const all = [...(overdue || []).map(t => ({...t, _overdue: true})), ...(dueToday || [])]
  
  if (!all.length) {
    el.innerHTML = '<div class="text-center py-6 text-slate-400"><i class="fas fa-check-circle text-2xl mb-2"></i><br>No urgent tasks!</div>'
    return
  }
  
  el.innerHTML = all.map(t => `
    <div class="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0" onclick="showTaskActions(${t.id})">
      <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0" style="background:${PRIORITY_COLORS[t.priority] || '#94a3b8'}"></div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-700 truncate">${t.title}</div>
        <div class="text-xs text-slate-400">${t.deal_title || t.contact_name || ''} · ${t._overdue ? '<span class="text-red-500">Overdue</span>' : 'Due today'}</div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-xs btn-success" onclick="event.stopPropagation();completeTask(${t.id})">Done</button>
        <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();snoozeTask(${t.id}, 1)">+1d</button>
      </div>
    </div>
  `).join('')
}

function renderDashActivity(activities) {
  const el = document.getElementById('dash-activity')
  if (!activities?.length) { el.innerHTML = '<div class="text-slate-400 text-sm text-center py-4">No recent activity</div>'; return }
  
  el.innerHTML = activities.map(a => `
    <div class="flex gap-3 items-start py-2 border-b border-slate-50">
      <div class="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
        <i class="fas ${getActionIcon(a.action)} text-indigo-400 text-xs"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm text-slate-700">${a.description || a.action}</div>
        <div class="text-xs text-slate-400">${a.deal_title || a.contact_name || ''} · ${timeAgo(a.created_at)}</div>
      </div>
    </div>
  `).join('')
}

function renderDashPOs(pos) {
  const el = document.getElementById('dash-pos')
  if (!pos?.length) { el.innerHTML = '<div class="text-slate-400 text-sm text-center py-4">No active orders</div>'; return }
  
  el.innerHTML = pos.map(po => `
    <div class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer" onclick="showPODetail(${po.id})">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-700">${po.po_number}</div>
        <div class="text-xs text-slate-400">${po.supplier_name} · ${po.deal_title || ''}</div>
      </div>
      <span class="stage-badge text-xs font-medium" style="background:${PO_STATUS_COLORS[po.status] || '#94a3b8'}20;color:${PO_STATUS_COLORS[po.status] || '#94a3b8'}">${po.status?.replace(/_/g,' ')}</span>
    </div>
  `).join('')
}

function renderDashNotifications(notifs) {
  const el = document.getElementById('dash-notifications')
  if (!notifs?.length) { el.innerHTML = '<div class="text-slate-400 text-sm text-center py-4"><i class="fas fa-bell-slash mb-2"></i><br>All caught up!</div>'; return }
  
  el.innerHTML = notifs.map(n => `
    <div class="flex gap-3 items-start p-2 hover:bg-slate-50 rounded-lg ${n.read ? 'opacity-60' : ''} cursor-pointer" onclick="markNotifRead(${n.id})">
      <div class="w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.read ? 'bg-slate-300' : getNotifColor(n.type)}"></div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-700">${n.title}</div>
        <div class="text-xs text-slate-400">${n.message || ''} · ${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `).join('')
}

// ============================================================
// PIPELINE KANBAN
// ============================================================
async function loadPipeline() {
  try {
    const { data } = await axios.get(`${API}/deals/pipeline`)
    renderKanban(data.pipeline, data.stages)
  } catch(e) { console.error(e) }
}

function renderKanban(pipeline, stages) {
  const el = document.getElementById('pipeline-kanban')
  const visibleStages = ['lead','qualified','proposal_sent','estimate_sent','estimate_accepted','invoice_sent','invoice_paid','order_placed','order_confirmed','shipping','delivered']
  
  el.innerHTML = visibleStages.map(stage => {
    const deals = pipeline[stage] || []
    const total = deals.reduce((s, d) => s + (d.value || 0), 0)
    const color = STAGE_COLORS[stage] || '#94a3b8'
    
    return `
      <div class="kanban-col flex-shrink-0">
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background:${color}"></div>
            <span class="text-xs font-semibold text-slate-600">${STAGE_LABELS[stage] || stage}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="badge" style="background:${color}20;color:${color}">${deals.length}</span>
          </div>
        </div>
        ${total > 0 ? `<div class="text-xs text-slate-400 px-1 mb-2">$${fmtNum(total)}</div>` : ''}
        <div class="space-y-2 min-h-20">
          ${deals.map(d => renderKanbanCard(d)).join('')}
        </div>
        <button class="w-full mt-2 text-xs text-slate-400 hover:text-indigo-500 py-2 border-2 border-dashed border-slate-200 rounded-lg hover:border-indigo-300 transition-colors" 
          onclick="showAddDealInStage('${stage}')">+ Add Deal</button>
      </div>
    `
  }).join('')
}

function renderKanbanCard(deal) {
  const priorityColor = PRIORITY_COLORS[deal.priority] || '#94a3b8'
  return `
    <div class="kanban-card" onclick="openDealDetail(${deal.id})">
      <div class="flex items-start gap-2 mb-2">
        <div class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style="background:${priorityColor}"></div>
        <div class="text-xs font-medium text-slate-700 leading-snug">${deal.title}</div>
      </div>
      ${deal.contact_name ? `<div class="text-xs text-slate-400 mb-1"><i class="fas fa-user text-xs mr-1"></i>${deal.contact_name}</div>` : ''}
      ${deal.value > 0 ? `<div class="text-xs font-semibold text-green-600">$${fmtNum(deal.value)}</div>` : ''}
    </div>
  `
}

async function openDealDetail(dealId) {
  const modal = document.getElementById('modal-deal-detail')
  const content = document.getElementById('deal-detail-content')
  
  content.innerHTML = `<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-2xl text-indigo-400"></i></div>`
  modal.classList.add('open')
  
  try {
    const { data } = await axios.get(`${API}/deals/${dealId}`)
    renderDealDetail(data, content)
    state.currentDeal = data.deal
  } catch(e) {
    content.innerHTML = `<div class="text-red-500 p-4">Error loading deal: ${e.message}</div>`
  }
}

function renderDealDetail(data, container) {
  const d = data.deal
  const stageColor = STAGE_COLORS[d.stage] || '#94a3b8'
  
  container.innerHTML = `
    <div class="flex items-start justify-between mb-4">
      <div>
        <h2 class="text-xl font-bold text-slate-800">${d.title}</h2>
        <div class="flex items-center gap-2 mt-1">
          <span class="stage-badge text-xs" style="background:${stageColor}20;color:${stageColor}">${STAGE_LABELS[d.stage] || d.stage}</span>
          ${d.contact_name ? `<span class="text-slate-400 text-sm"><i class="fas fa-user mr-1"></i>${d.contact_name}</span>` : ''}
          ${d.value > 0 ? `<span class="text-green-600 font-semibold">$${fmtNum(d.value)}</span>` : ''}
        </div>
      </div>
      <button onclick="closeModal('modal-deal-detail')" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
    </div>
    
    <!-- Quick Actions -->
    <div class="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-100">
      <button class="btn btn-secondary btn-xs" onclick="analyzeDeal(${d.id})"><i class="fas fa-brain"></i> AI Analyze</button>
      <button class="btn btn-secondary btn-xs" onclick="generateTasks(${d.id})"><i class="fas fa-magic"></i> Auto Tasks</button>
      <button class="btn btn-secondary btn-xs" onclick="openCommModal(${d.id}, ${d.contact_id})"><i class="fas fa-envelope"></i> Send Email</button>
      <button class="btn btn-secondary btn-xs" onclick="openSMSModal(${d.id}, ${d.contact_id})"><i class="fas fa-sms"></i> Send SMS</button>
      <button class="btn btn-secondary btn-xs" onclick="openCreateEstimateModal(${d.id})"><i class="fas fa-file-invoice"></i> Create Estimate</button>
      <button class="btn btn-secondary btn-xs" onclick="openCreatePOModal(${d.id})"><i class="fas fa-shopping-cart"></i> Create PO</button>
      <button class="btn btn-warning btn-xs" onclick="editDeal(${d.id})"><i class="fas fa-edit"></i> Edit</button>
    </div>
    
    <!-- Stage Progression -->
    <div class="mb-4 pb-4 border-b border-slate-100">
      <div class="text-xs font-semibold text-slate-500 mb-2">MOVE TO STAGE</div>
      <div class="flex flex-wrap gap-1">
        ${Object.entries(STAGE_LABELS).filter(([k]) => !['lost','on_hold','completed'].includes(k)).map(([k,v]) => `
          <button class="text-xs px-2 py-1 rounded-full border cursor-pointer transition-all ${d.stage === k ? 'font-bold' : 'text-slate-500 border-slate-200 hover:border-indigo-300'}"
            style="${d.stage === k ? `background:${STAGE_COLORS[k]}20;border-color:${STAGE_COLORS[k]};color:${STAGE_COLORS[k]}` : ''}"
            onclick="updateDealStage(${d.id}, '${k}')">${v}</button>
        `).join('')}
      </div>
    </div>
    
    <!-- AI Summary -->
    ${d.ai_status_summary ? `
      <div class="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
        <div class="text-xs font-semibold text-indigo-600 mb-1"><i class="fas fa-brain mr-1"></i>AI STATUS</div>
        <div class="text-sm text-slate-700 mb-2">${d.ai_status_summary}</div>
        ${d.ai_next_action ? `<div class="text-xs font-semibold text-green-600"><i class="fas fa-arrow-right mr-1"></i>NEXT ACTION: ${d.ai_next_action}</div>` : ''}
      </div>
    ` : ''}
    
    <!-- Tabs -->
    <div class="flex gap-1 mb-4" id="deal-detail-tabs">
      <button class="tab-btn active" onclick="showDealTab('comms', this)">Communications (${data.communications?.length || 0})</button>
      <button class="tab-btn" onclick="showDealTab('tasks', this)">Tasks (${data.tasks?.length || 0})</button>
      <button class="tab-btn" onclick="showDealTab('finance', this)">Finance</button>
      <button class="tab-btn" onclick="showDealTab('orders', this)">Orders</button>
      <button class="tab-btn" onclick="showDealTab('activity', this)">Activity</button>
    </div>
    
    <div id="deal-tab-comms">
      ${renderCommsList(data.communications)}
    </div>
    <div id="deal-tab-tasks" style="display:none">
      ${renderTasksList(data.tasks)}
    </div>
    <div id="deal-tab-finance" style="display:none">
      ${renderFinanceTab(data)}
    </div>
    <div id="deal-tab-orders" style="display:none">
      ${renderOrdersTab(data)}
    </div>
    <div id="deal-tab-activity" style="display:none">
      ${renderActivityList(data.activity)}
    </div>
  `
}

function showDealTab(tab, btn) {
  document.querySelectorAll('#deal-detail-content [id^="deal-tab-"]').forEach(el => el.style.display = 'none')
  document.querySelectorAll('#deal-detail-content .tab-btn').forEach(b => b.classList.remove('active'))
  document.getElementById(`deal-tab-${tab}`).style.display = 'block'
  btn.classList.add('active')
}

function renderCommsList(comms) {
  if (!comms?.length) return '<div class="text-slate-400 text-sm text-center py-4">No communications yet</div>'
  return `<div class="space-y-2 max-h-64 overflow-y-auto">` + comms.map(c => `
    <div class="flex gap-3 items-start p-3 bg-slate-50 rounded-lg">
      <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:${c.direction === 'inbound' ? '#dbeafe' : '#f0fdf4'}">
        <i class="fas ${COMM_ICONS[c.type] || 'fa-comment'} text-xs" style="color:${c.direction === 'inbound' ? '#3b82f6' : '#22c55e'}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-xs font-medium text-slate-600">${c.type?.toUpperCase()} ${c.direction === 'inbound' ? '↓' : '↑'}</span>
          <span class="text-xs text-slate-400">${timeAgo(c.created_at)}</span>
        </div>
        ${c.subject ? `<div class="text-sm font-medium text-slate-700">${c.subject}</div>` : ''}
        ${c.summary || c.body ? `<div class="text-xs text-slate-500 mt-1 truncate">${c.summary || c.body?.substring(0,100)}</div>` : ''}
      </div>
    </div>
  `).join('') + '</div>'
}

function renderTasksList(tasks) {
  if (!tasks?.length) return '<div class="text-slate-400 text-sm text-center py-4">No tasks</div>'
  return `<div class="space-y-2">` + tasks.map(t => `
    <div class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
      <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} 
        onchange="completeTask(${t.id})" class="w-4 h-4 accent-indigo-500">
      <div class="flex-1">
        <div class="text-sm ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}">${t.title}</div>
        <div class="text-xs text-slate-400">${t.type} · ${t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</div>
      </div>
      <div class="w-2 h-2 rounded-full" style="background:${PRIORITY_COLORS[t.priority]}"></div>
    </div>
  `).join('') + '</div>'
}

function renderFinanceTab(data) {
  const estimates = data.estimates || []
  const invoices = data.invoices || []
  return `
    <div class="space-y-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-semibold text-slate-600">Estimates</h4>
          <button class="btn btn-xs btn-secondary" onclick="openCreateEstimateModal(${data.deal.id})">+ New</button>
        </div>
        ${estimates.length ? estimates.map(e => `
          <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg mb-2">
            <div class="flex-1">
              <div class="text-sm font-medium">${e.estimate_number}</div>
              <div class="text-xs text-slate-400">$${fmtNum(e.total)} · ${e.status}</div>
            </div>
            ${e.quickbooks_url ? `<a href="${e.quickbooks_url}" target="_blank" class="btn btn-xs btn-secondary">QB</a>` : ''}
          </div>
        `).join('') : '<div class="text-slate-400 text-xs">No estimates yet</div>'}
      </div>
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-semibold text-slate-600">Invoices</h4>
          <button class="btn btn-xs btn-secondary" onclick="openCreateInvoiceModal(${data.deal.id})">+ New</button>
        </div>
        ${invoices.length ? invoices.map(i => `
          <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg mb-2">
            <div class="flex-1">
              <div class="text-sm font-medium">${i.invoice_number}</div>
              <div class="text-xs text-slate-400">$${fmtNum(i.total)} · ${i.status}</div>
            </div>
            ${i.status !== 'paid' ? `<button class="btn btn-xs btn-success" onclick="markInvoicePaid(${i.id})">Mark Paid</button>` : '<span class="text-green-600 text-xs font-semibold">✓ PAID</span>'}
            ${i.quickbooks_url ? `<a href="${i.quickbooks_url}" target="_blank" class="btn btn-xs btn-secondary">QB</a>` : ''}
          </div>
        `).join('') : '<div class="text-slate-400 text-xs">No invoices yet</div>'}
      </div>
    </div>
  `
}

function renderOrdersTab(data) {
  const pos = data.purchase_orders || []
  const shipments = data.shipments || []
  return `
    <div class="space-y-4">
      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-sm font-semibold text-slate-600">Purchase Orders</h4>
          <button class="btn btn-xs btn-secondary" onclick="openCreatePOModal(${data.deal.id})">+ New PO</button>
        </div>
        ${pos.length ? pos.map(po => `
          <div class="flex items-center gap-3 p-2 bg-slate-50 rounded-lg mb-2">
            <div class="flex-1">
              <div class="text-sm font-medium">${po.po_number}</div>
              <div class="text-xs text-slate-400">${po.supplier_name} · $${fmtNum(po.total)}</div>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full" style="background:${PO_STATUS_COLORS[po.status] || '#94a3b8'}20;color:${PO_STATUS_COLORS[po.status] || '#94a3b8'}">${po.status?.replace(/_/g,' ')}</span>
            ${po.status === 'confirmed' ? `<button class="btn btn-xs btn-primary" onclick="showAddTracking(${po.id})">Add Tracking</button>` : ''}
            ${po.status === 'draft' || po.status === 'approved' ? `<button class="btn btn-xs btn-secondary" onclick="requestQuote(${po.id})">Request Quote</button>` : ''}
          </div>
        `).join('') : '<div class="text-slate-400 text-xs">No orders yet</div>'}
      </div>
      ${shipments.length ? `
        <div>
          <h4 class="text-sm font-semibold text-slate-600 mb-2">Shipments</h4>
          ${shipments.map(s => `
            <div class="p-2 bg-slate-50 rounded-lg mb-2">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium">${s.carrier} · ${s.tracking_number}</div>
                <a href="${s.tracking_url}" target="_blank" class="btn btn-xs btn-secondary">Track</a>
              </div>
              <div class="text-xs text-slate-400">${s.status} ${s.estimated_delivery ? '· ETA: ' + s.estimated_delivery : ''}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `
}

function renderActivityList(activities) {
  if (!activities?.length) return '<div class="text-slate-400 text-sm text-center py-4">No activity</div>'
  return `<div class="space-y-2 max-h-64 overflow-y-auto">` + activities.map(a => `
    <div class="flex gap-3 items-start py-2 border-b border-slate-50">
      <div class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <i class="fas ${getActionIcon(a.action)} text-slate-400 text-xs"></i>
      </div>
      <div>
        <div class="text-sm text-slate-700">${a.description}</div>
        <div class="text-xs text-slate-400">${timeAgo(a.created_at)} · ${a.performed_by}</div>
      </div>
    </div>
  `).join('') + '</div>'
}

// ============================================================
// CONTACTS
// ============================================================
async function loadContacts(search = '', type = '') {
  try {
    const { data } = await axios.get(`${API}/contacts`, { params: { search, type, limit: 100 } })
    state.contacts = data.contacts
    renderContactsTable(data.contacts)
  } catch(e) { console.error(e) }
}

function renderContactsTable(contacts) {
  const el = document.getElementById('contacts-list')
  if (!contacts?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-users text-4xl mb-3"></i><br>No contacts yet. <button class="btn btn-primary btn-sm mt-2" onclick="showAddContact()">Add First Contact</button></div>`
    return
  }
  
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-100">
            <th class="text-left p-3 text-slate-600 font-semibold">Name</th>
            <th class="text-left p-3 text-slate-600 font-semibold">Company</th>
            <th class="text-left p-3 text-slate-600 font-semibold">Contact</th>
            <th class="text-left p-3 text-slate-600 font-semibold">Type</th>
            <th class="text-left p-3 text-slate-600 font-semibold">Location</th>
            <th class="text-left p-3 text-slate-600 font-semibold">Last Contact</th>
            <th class="p-3"></th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(c => `
            <tr class="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onclick="openContactDetail(${c.id})">
              <td class="p-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-xs">
                    ${c.first_name?.[0]}${c.last_name?.[0]}
                  </div>
                  <div>
                    <div class="font-medium text-slate-800">${c.first_name} ${c.last_name}</div>
                    ${c.title ? `<div class="text-xs text-slate-400">${c.title}</div>` : ''}
                  </div>
                </div>
              </td>
              <td class="p-3 text-slate-600">${c.company_name || '—'}</td>
              <td class="p-3">
                ${c.email ? `<div class="text-slate-600 truncate max-w-32">${c.email}</div>` : ''}
                ${c.phone ? `<div class="text-slate-400 text-xs">${c.phone}</div>` : ''}
              </td>
              <td class="p-3">
                <span class="stage-badge text-xs" style="background:${getTypeColor(c.type)}20;color:${getTypeColor(c.type)}">${c.type || 'lead'}</span>
              </td>
              <td class="p-3 text-slate-500 text-xs">${[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
              <td class="p-3 text-slate-400 text-xs">${c.last_contacted_at ? timeAgo(c.last_contacted_at) : 'Never'}</td>
              <td class="p-3">
                <div class="flex gap-1">
                  <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();editContact(${c.id})"><i class="fas fa-edit"></i></button>
                  <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();quickEmail(${c.id}, '${c.email}', '${c.first_name}')"><i class="fas fa-envelope"></i></button>
                  <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();quickSMS(${c.id}, '${c.mobile || c.phone}')"><i class="fas fa-sms"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function filterContacts(search) {
  loadContacts(search, document.querySelector('.select')?.value || '')
}
function filterContactsByType(type) {
  loadContacts(document.getElementById('contact-search')?.value || '', type)
}

async function openContactDetail(id) {
  try {
    const { data } = await axios.get(`${API}/contacts/${id}`)
    const c = data.contact
    
    const modal = document.createElement('div')
    modal.className = 'modal open'
    modal.id = `modal-contact-detail-${id}`
    modal.innerHTML = `
      <div class="modal-box" style="max-width:850px;width:95vw">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-content-center text-indigo-600 font-bold text-lg" style="display:flex;align-items:center;justify-content:center">
              ${c.first_name?.[0]}${c.last_name?.[0]}
            </div>
            <div>
              <h2 class="text-xl font-bold">${c.first_name} ${c.last_name}</h2>
              <div class="text-slate-400 text-sm">${c.title || ''} ${c.company_name ? '· ' + c.company_name : ''}</div>
            </div>
          </div>
          <button onclick="this.closest('.modal').remove()" class="text-slate-400 text-xl">&times;</button>
        </div>
        <div class="grid-2 gap-4 mb-4">
          <div class="space-y-2">
            ${c.email ? `<div class="flex gap-2 items-center"><i class="fas fa-envelope text-slate-400 w-4"></i> <a href="mailto:${c.email}" class="text-indigo-600 hover:underline text-sm">${c.email}</a></div>` : ''}
            ${c.phone ? `<div class="flex gap-2 items-center"><i class="fas fa-phone text-slate-400 w-4"></i> <span class="text-sm">${c.phone}</span></div>` : ''}
            ${c.mobile ? `<div class="flex gap-2 items-center"><i class="fas fa-mobile-alt text-slate-400 w-4"></i> <span class="text-sm">${c.mobile}</span></div>` : ''}
            ${[c.city, c.state].filter(Boolean).length ? `<div class="flex gap-2 items-center"><i class="fas fa-map-marker-alt text-slate-400 w-4"></i> <span class="text-sm">${[c.city, c.state].filter(Boolean).join(', ')}</span></div>` : ''}
          </div>
          <div class="space-y-2">
            <div class="flex gap-2 flex-wrap">
              <button class="btn btn-primary btn-xs" onclick="quickEmail(${c.id}, '${c.email}', '${c.first_name}')"><i class="fas fa-envelope"></i> Email</button>
              <button class="btn btn-secondary btn-xs" onclick="quickSMS(${c.id}, '${c.mobile || c.phone}')"><i class="fas fa-sms"></i> SMS</button>
              <button class="btn btn-secondary btn-xs" onclick="showAddDealForContact(${c.id}, '${c.first_name} ${c.last_name}')"><i class="fas fa-plus"></i> New Deal</button>
              <button class="btn btn-secondary btn-xs" onclick="editContact(${c.id})"><i class="fas fa-edit"></i> Edit</button>
            </div>
            ${c.ai_summary ? `<div class="text-xs text-slate-500 bg-indigo-50 p-2 rounded">${c.ai_summary}</div>` : ''}
          </div>
        </div>
        <div class="grid-2 gap-4">
          <div>
            <h4 class="text-sm font-semibold text-slate-600 mb-2">Deals (${data.deals?.length || 0})</h4>
            ${(data.deals || []).map(d => `
              <div class="p-2 bg-slate-50 rounded mb-1 cursor-pointer hover:bg-slate-100" onclick="openDealDetail(${d.id})">
                <div class="text-sm font-medium">${d.title}</div>
                <div class="text-xs text-slate-400">${STAGE_LABELS[d.stage] || d.stage} ${d.value ? '· $' + fmtNum(d.value) : ''}</div>
              </div>
            `).join('') || '<div class="text-slate-400 text-xs">No deals</div>'}
          </div>
          <div>
            <h4 class="text-sm font-semibold text-slate-600 mb-2">Recent Communications</h4>
            ${(data.communications || []).slice(0, 5).map(c => `
              <div class="p-2 bg-slate-50 rounded mb-1">
                <div class="flex items-center gap-2">
                  <i class="fas ${COMM_ICONS[c.type] || 'fa-comment'} text-xs text-slate-400"></i>
                  <span class="text-xs font-medium">${c.subject || c.type}</span>
                  <span class="text-xs text-slate-400 ml-auto">${timeAgo(c.created_at)}</span>
                </div>
              </div>
            `).join('') || '<div class="text-slate-400 text-xs">No communications</div>'}
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  } catch(e) { showToast('Error loading contact', 'error') }
}

// ============================================================
// COMPANIES
// ============================================================
async function loadCompanies() {
  try {
    const { data } = await axios.get(`${API}/companies`)
    renderCompaniesList(data.companies)
  } catch(e) { console.error(e) }
}

function renderCompaniesList(companies) {
  const el = document.getElementById('companies-list')
  if (!companies?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-building text-4xl mb-3"></i><br>No companies yet.</div>`
    return
  }
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b">
          <th class="text-left p-3 text-slate-600 font-semibold">Company</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Type</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Contact</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Location</th>
          <th class="p-3"></th>
        </tr></thead>
        <tbody>${companies.map(c => `
          <tr class="border-b border-slate-50 hover:bg-slate-50">
            <td class="p-3">
              <div class="font-medium text-slate-800">${c.name}</div>
              ${c.website ? `<div class="text-xs text-indigo-400"><a href="${c.website}" target="_blank">${c.website.replace('https://','')}</a></div>` : ''}
            </td>
            <td class="p-3"><span class="stage-badge text-xs" style="background:${getTypeColor(c.type)}20;color:${getTypeColor(c.type)}">${c.type}</span></td>
            <td class="p-3 text-slate-500 text-xs">${c.email || c.phone || '—'}</td>
            <td class="p-3 text-slate-400 text-xs">${[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
            <td class="p-3"><button class="btn btn-xs btn-secondary" onclick="editCompany(${c.id})"><i class="fas fa-edit"></i></button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `
}

// ============================================================
// TASKS
// ============================================================
async function loadTasks(status = 'pending') {
  try {
    const { data } = await axios.get(`${API}/tasks`, { params: { status, limit: 100 } })
    renderTasksPage(data.tasks)
  } catch(e) { console.error(e) }
}

function renderTasksPage(tasks) {
  const el = document.getElementById('tasks-list')
  if (!tasks?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-check-circle text-4xl mb-3"></i><br>No tasks in this status</div>`
    return
  }
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b">
          <th class="p-3 w-8"></th>
          <th class="text-left p-3 text-slate-600 font-semibold">Task</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Type</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Related To</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Due</th>
          <th class="text-left p-3 text-slate-600 font-semibold">Priority</th>
          <th class="p-3"></th>
        </tr></thead>
        <tbody>${tasks.map(t => {
          const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
          return `
          <tr class="border-b border-slate-50 hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}">
            <td class="p-3"><input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} onchange="completeTask(${t.id})" class="accent-indigo-500"></td>
            <td class="p-3">
              <div class="font-medium ${t.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}">${t.title}</div>
              ${t.description ? `<div class="text-xs text-slate-400">${t.description}</div>` : ''}
              ${t.ai_generated ? '<span class="text-xs text-indigo-400"><i class="fas fa-brain"></i> AI</span>' : ''}
            </td>
            <td class="p-3"><span class="text-xs text-slate-500">${t.type?.replace(/_/g,' ') || ''}</span></td>
            <td class="p-3 text-xs text-slate-500">${t.deal_title || t.contact_name || '—'}</td>
            <td class="p-3 text-xs ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-500'}">${t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
            <td class="p-3"><div class="w-2 h-2 rounded-full" style="background:${PRIORITY_COLORS[t.priority]}"></div></td>
            <td class="p-3">
              <div class="flex gap-1">
                <button class="btn btn-xs btn-success" onclick="completeTask(${t.id})">Done</button>
                <button class="btn btn-xs btn-secondary" onclick="snoozeTask(${t.id}, 1)">+1d</button>
                <button class="btn btn-xs btn-secondary" onclick="deleteTask(${t.id})"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>`
        }).join('')}</tbody>
      </table>
    </div>
  `
}

function filterTasks(status, btn) {
  document.querySelectorAll('#page-tasks .tab-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  loadTasks(status)
}

async function completeTask(id) {
  try {
    await axios.patch(`${API}/tasks/${id}/complete`)
    showToast('Task completed!', 'success')
    if (state.currentPage === 'tasks') loadTasks('pending')
    if (state.currentPage === 'dashboard') loadDashboard()
  } catch(e) { showToast('Error completing task', 'error') }
}

async function snoozeTask(id, days) {
  try {
    await axios.patch(`${API}/tasks/${id}/snooze`, { days })
    showToast(`Task snoozed for ${days} day(s)`, 'success')
    if (state.currentPage === 'tasks') loadTasks('pending')
    if (state.currentPage === 'dashboard') loadDashboard()
  } catch(e) { showToast('Error snoozing task', 'error') }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return
  await axios.delete(`${API}/tasks/${id}`)
  showToast('Task deleted', 'success')
  loadTasks('pending')
}

async function generateTasks(dealId) {
  try {
    showToast('Generating smart tasks...', 'info')
    const { data } = await axios.post(`${API}/tasks/generate`, { deal_id: dealId })
    showToast(`Created ${data.created_count} tasks!`, 'success')
    if (state.currentDeal?.id === dealId) openDealDetail(dealId)
  } catch(e) { showToast('Error generating tasks', 'error') }
}

// ============================================================
// COMMUNICATIONS
// ============================================================
async function loadCommunications() {
  try {
    const { data } = await axios.get(`${API}/communications`, { params: { limit: 50 } })
    renderCommunicationsPage(data.communications)
  } catch(e) { console.error(e) }
}

function renderCommunicationsPage(comms) {
  const el = document.getElementById('communications-list')
  if (!comms?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-comments text-4xl mb-3"></i><br>No communications logged yet.</div>`
    return
  }
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b">
          <th class="text-left p-3">Type</th>
          <th class="text-left p-3">Subject / Content</th>
          <th class="text-left p-3">Contact</th>
          <th class="text-left p-3">Deal</th>
          <th class="text-left p-3">Date</th>
          <th class="text-left p-3">Status</th>
        </tr></thead>
        <tbody>${comms.map(c => `
          <tr class="border-b border-slate-50 hover:bg-slate-50">
            <td class="p-3">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full flex items-center justify-content-center" style="display:flex;align-items:center;justify-content:center;background:${c.direction === 'inbound' ? '#dbeafe' : '#f0fdf4'}">
                  <i class="fas ${COMM_ICONS[c.type] || 'fa-comment'} text-xs" style="color:${c.direction === 'inbound' ? '#3b82f6' : '#22c55e'}"></i>
                </div>
                <span class="text-xs font-medium text-slate-600">${c.type?.toUpperCase()}</span>
              </div>
            </td>
            <td class="p-3 max-w-xs">
              <div class="text-slate-700 font-medium truncate">${c.subject || '—'}</div>
              ${c.summary ? `<div class="text-xs text-slate-400 truncate">${c.summary}</div>` : ''}
            </td>
            <td class="p-3 text-slate-600 text-sm">${c.contact_name || c.from_address || '—'}</td>
            <td class="p-3 text-slate-500 text-xs">${c.deal_title || '—'}</td>
            <td class="p-3 text-slate-400 text-xs">${timeAgo(c.created_at)}</td>
            <td class="p-3"><span class="text-xs text-slate-500">${c.status || '—'}</span></td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `
}

async function syncGmail() {
  showToast('Syncing Gmail...', 'info')
  try {
    const { data } = await axios.post(`${API}/communications/gmail-sync`)
    showToast(data.message || 'Sync complete', data.success ? 'success' : 'warning')
    if (state.currentPage === 'communications') loadCommunications()
  } catch(e) { showToast('Gmail sync error: ' + e.message, 'error') }
}

// ============================================================
// ESTIMATES
// ============================================================
async function loadEstimates() {
  try {
    const { data } = await axios.get(`${API}/estimates`)
    renderEstimatesPage(data.estimates)
  } catch(e) { console.error(e) }
}

function renderEstimatesPage(estimates) {
  const el = document.getElementById('estimates-list')
  if (!estimates?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-file-invoice text-4xl mb-3"></i><br>No estimates yet.</div>`
    return
  }
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b">
          <th class="text-left p-3">Number</th>
          <th class="text-left p-3">Contact</th>
          <th class="text-left p-3">Total</th>
          <th class="text-left p-3">Status</th>
          <th class="text-left p-3">Valid Until</th>
          <th class="p-3"></th>
        </tr></thead>
        <tbody>${estimates.map(e => `
          <tr class="border-b hover:bg-slate-50">
            <td class="p-3 font-medium text-indigo-600">${e.estimate_number}</td>
            <td class="p-3 text-slate-600">${e.contact_name || '—'}</td>
            <td class="p-3 text-green-600 font-semibold">$${fmtNum(e.total)}</td>
            <td class="p-3"><span class="stage-badge text-xs" style="background:#f0fdf420;color:#16a34a">${e.status}</span></td>
            <td class="p-3 text-slate-400 text-xs">${e.valid_until || '—'}</td>
            <td class="p-3">
              ${e.quickbooks_url ? `<a href="${e.quickbooks_url}" target="_blank" class="btn btn-xs btn-secondary">View QB</a>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `
}

// ============================================================
// INVOICES
// ============================================================
async function loadInvoices() {
  try {
    const { data } = await axios.get(`${API}/invoices`)
    renderInvoicesPage(data.invoices)
  } catch(e) { console.error(e) }
}

function renderInvoicesPage(invoices) {
  const el = document.getElementById('invoices-list')
  if (!invoices?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-dollar-sign text-4xl mb-3"></i><br>No invoices yet.</div>`
    return
  }
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b">
          <th class="text-left p-3">Number</th>
          <th class="text-left p-3">Contact</th>
          <th class="text-left p-3">Total</th>
          <th class="text-left p-3">Amount Due</th>
          <th class="text-left p-3">Status</th>
          <th class="text-left p-3">Due Date</th>
          <th class="p-3"></th>
        </tr></thead>
        <tbody>${invoices.map(i => {
          const isOverdue = i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()
          return `
          <tr class="border-b hover:bg-slate-50 ${isOverdue ? 'bg-red-50' : ''}">
            <td class="p-3 font-medium text-indigo-600">${i.invoice_number}</td>
            <td class="p-3 text-slate-600">${i.contact_name || '—'}</td>
            <td class="p-3 text-green-600 font-semibold">$${fmtNum(i.total)}</td>
            <td class="p-3 ${i.amount_due > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}">$${fmtNum(i.amount_due || 0)}</td>
            <td class="p-3">
              <span class="stage-badge text-xs" style="background:${i.status === 'paid' ? '#22c55e20' : isOverdue ? '#ef444420' : '#f59e0b20'};color:${i.status === 'paid' ? '#16a34a' : isOverdue ? '#dc2626' : '#d97706'}">
                ${i.status}${isOverdue ? ' (OVERDUE)' : ''}
              </span>
            </td>
            <td class="p-3 text-slate-400 text-xs">${i.due_date || '—'}</td>
            <td class="p-3">
              <div class="flex gap-1">
                ${i.status !== 'paid' ? `<button class="btn btn-xs btn-success" onclick="markInvoicePaid(${i.id})">Mark Paid</button>` : ''}
                ${i.quickbooks_url ? `<a href="${i.quickbooks_url}" target="_blank" class="btn btn-xs btn-secondary">QB</a>` : ''}
              </div>
            </td>
          </tr>`
        }).join('')}</tbody>
      </table>
    </div>
  `
}

async function markInvoicePaid(id) {
  const method = prompt('Payment method? (check, wire, credit_card, cash)')
  if (method === null) return
  try {
    await axios.patch(`${API}/invoices/${id}/paid`, { payment_method: method })
    showToast('💰 Invoice marked as paid! Order can now be placed.', 'success')
    loadInvoices()
  } catch(e) { showToast('Error', 'error') }
}

// ============================================================
// PURCHASE ORDERS
// ============================================================
async function loadPurchaseOrders() {
  try {
    const { data } = await axios.get(`${API}/purchase-orders`)
    renderPOsPage(data.purchase_orders)
  } catch(e) { console.error(e) }
}

function renderPOsPage(pos) {
  const el = document.getElementById('po-list')
  if (!pos?.length) {
    el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-shopping-cart text-4xl mb-3"></i><br>No purchase orders yet.</div>`
    return
  }
  el.innerHTML = `
    <div class="card overflow-hidden p-0">
      <table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b">
          <th class="text-left p-3">PO Number</th>
          <th class="text-left p-3">Supplier</th>
          <th class="text-left p-3">Deal</th>
          <th class="text-left p-3">Total</th>
          <th class="text-left p-3">Status</th>
          <th class="text-left p-3">Expected Delivery</th>
          <th class="p-3"></th>
        </tr></thead>
        <tbody>${pos.map(po => `
          <tr class="border-b hover:bg-slate-50 cursor-pointer" onclick="showPODetail(${po.id})">
            <td class="p-3 font-medium text-indigo-600">${po.po_number}</td>
            <td class="p-3 text-slate-600">${po.supplier_name || '—'}</td>
            <td class="p-3 text-slate-500 text-xs">${po.deal_title || '—'}</td>
            <td class="p-3 text-green-600 font-semibold">$${fmtNum(po.total)}</td>
            <td class="p-3">
              <span class="stage-badge text-xs" style="background:${PO_STATUS_COLORS[po.status] || '#94a3b8'}20;color:${PO_STATUS_COLORS[po.status] || '#94a3b8'}">
                ${po.status?.replace(/_/g,' ')}
              </span>
            </td>
            <td class="p-3 text-slate-400 text-xs">${po.expected_delivery || '—'}</td>
            <td class="p-3">
              <div class="flex gap-1" onclick="event.stopPropagation()">
                ${po.status === 'draft' || po.status === 'approved' ? `<button class="btn btn-xs btn-secondary" onclick="requestQuote(${po.id})">Request Quote</button>` : ''}
                ${po.status === 'confirmed' ? `<button class="btn btn-xs btn-primary" onclick="showAddTracking(${po.id})">Add Tracking</button>` : ''}
                <button class="btn btn-xs btn-secondary" onclick="editPOStatus(${po.id})">Update</button>
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `
}

async function showPODetail(id) {
  try {
    const { data } = await axios.get(`${API}/purchase-orders/${id}`)
    const po = data.purchase_order
    const lineItems = JSON.parse(po.line_items || '[]')
    const tracking = JSON.parse(po.tracking_numbers || '[]')
    
    const modal = document.createElement('div')
    modal.className = 'modal open'
    modal.innerHTML = `
      <div class="modal-box modal-box-lg">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-xl font-bold">${po.po_number}</h3>
            <span class="stage-badge text-xs mt-1" style="background:${PO_STATUS_COLORS[po.status]}20;color:${PO_STATUS_COLORS[po.status]}">${po.status?.replace(/_/g,' ')}</span>
          </div>
          <button onclick="this.closest('.modal').remove()" class="text-slate-400 text-xl">&times;</button>
        </div>
        <div class="grid-2 mb-4">
          <div><span class="text-sm text-slate-500">Supplier:</span> <span class="font-medium">${po.supplier_name || '—'}</span></div>
          <div><span class="text-sm text-slate-500">Deal:</span> <span class="font-medium">${po.deal_title || '—'}</span></div>
          <div><span class="text-sm text-slate-500">Total:</span> <span class="text-green-600 font-bold">$${fmtNum(po.total)}</span></div>
          <div><span class="text-sm text-slate-500">Expected:</span> <span class="font-medium">${po.expected_delivery || '—'}</span></div>
          ${po.supplier_order_number ? `<div><span class="text-sm text-slate-500">Supplier Order#:</span> <span class="font-medium">${po.supplier_order_number}</span></div>` : ''}
        </div>
        <div class="mb-4">
          <h4 class="text-sm font-semibold mb-2">Line Items</h4>
          ${lineItems.length ? `
            <table class="w-full text-xs border rounded-lg overflow-hidden">
              <thead class="bg-slate-50"><tr>
                <th class="text-left p-2">Item</th>
                <th class="text-right p-2">Qty</th>
                <th class="text-right p-2">Price</th>
                <th class="text-right p-2">Total</th>
              </tr></thead>
              <tbody>${lineItems.map((item, i) => `
                <tr class="border-t"><td class="p-2">${item.description || item.name}</td>
                <td class="p-2 text-right">${item.quantity || 1}</td>
                <td class="p-2 text-right">$${fmtNum(item.unit_price || 0)}</td>
                <td class="p-2 text-right font-medium">$${fmtNum((item.quantity || 1) * (item.unit_price || 0))}</td></tr>
              `).join('')}</tbody>
            </table>
          ` : '<div class="text-slate-400 text-xs">No line items</div>'}
        </div>
        ${tracking.length ? `
          <div class="mb-4">
            <h4 class="text-sm font-semibold mb-2">Tracking Numbers</h4>
            ${tracking.map(t => `<div class="text-sm text-indigo-600 font-mono">${t}</div>`).join('')}
          </div>
        ` : ''}
        <div class="flex gap-2 flex-wrap">
          ${po.status === 'draft' || po.status === 'approved' ? `<button class="btn btn-secondary btn-sm" onclick="requestQuote(${po.id})"><i class="fas fa-paper-plane"></i> Request Quote</button>` : ''}
          ${po.status === 'confirmed' ? `<button class="btn btn-primary btn-sm" onclick="showAddTracking(${po.id})"><i class="fas fa-truck"></i> Add Tracking</button>` : ''}
          <button class="btn btn-secondary btn-sm" onclick="editPOStatus(${po.id})">Update Status</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  } catch(e) { showToast('Error loading PO', 'error') }
}

async function loadShipments() {
  const el = document.getElementById('shipments-list')
  try {
    // Pull from POs with tracking
    const { data } = await axios.get(`${API}/purchase-orders`)
    const withTracking = data.purchase_orders.filter(p => {
      try { return JSON.parse(p.tracking_numbers || '[]').length > 0 } catch { return false }
    })
    
    if (!withTracking.length) {
      el.innerHTML = `<div class="card text-center py-12 text-slate-400"><i class="fas fa-truck text-4xl mb-3"></i><br>No shipments to track yet.</div>`
      return
    }
    
    el.innerHTML = `
      <div class="card overflow-hidden p-0">
        <table class="w-full text-sm">
          <thead><tr class="bg-slate-50 border-b">
            <th class="text-left p-3">PO Number</th>
            <th class="text-left p-3">Supplier</th>
            <th class="text-left p-3">Tracking Numbers</th>
            <th class="text-left p-3">Carrier</th>
            <th class="text-left p-3">Status</th>
            <th class="text-left p-3">Expected Delivery</th>
          </tr></thead>
          <tbody>${withTracking.map(po => {
            const tracking = JSON.parse(po.tracking_numbers || '[]')
            return `
            <tr class="border-b hover:bg-slate-50">
              <td class="p-3 font-medium text-indigo-600">${po.po_number}</td>
              <td class="p-3">${po.supplier_name}</td>
              <td class="p-3">${tracking.map(t => `
                <div class="font-mono text-xs text-slate-700">${t}</div>
              `).join('')}</td>
              <td class="p-3 text-slate-500">${po.shipping_carrier || '—'}</td>
              <td class="p-3">
                <span class="stage-badge text-xs" style="background:${PO_STATUS_COLORS[po.status]}20;color:${PO_STATUS_COLORS[po.status]}">${po.status?.replace(/_/g,' ')}</span>
              </td>
              <td class="p-3 text-slate-400 text-xs">${po.expected_delivery || '—'}</td>
            </tr>`
          }).join('')}</tbody>
        </table>
      </div>
    `
  } catch(e) { console.error(e) }
}

// ============================================================
// SETTINGS
// ============================================================
async function loadSettings() {
  try {
    const { data } = await axios.get(`${API}/settings`)
    renderSettings(data.settings)
  } catch(e) { console.error(e) }
}

function renderSettings(settings) {
  const el = document.getElementById('settings-content')
  el.innerHTML = `
    <div class="grid gap-6" style="grid-template-columns:1fr 1fr">
      <!-- Company Settings -->
      <div class="card">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-building text-indigo-500 mr-2"></i>Company Info</h3>
        <div class="space-y-3">
          <div><label class="label">Company Name</label><input class="input" id="s-company_name" value="${settings.company_name || 'Amberway Equine LLC'}"></div>
          <div><label class="label">Company Email</label><input class="input" id="s-company_email" value="${settings.company_email || ''}"></div>
          <div><label class="label">Company Phone</label><input class="input" id="s-company_phone" value="${settings.company_phone || ''}"></div>
          <button class="btn btn-primary btn-sm" onclick="saveSettings(['company_name','company_email','company_phone'])">
            <i class="fas fa-save"></i> Save
          </button>
        </div>
      </div>
      
      <!-- Gmail Integration -->
      <div class="card">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fab fa-google text-red-500 mr-2"></i>Gmail Integration</h3>
        <div class="p-3 rounded-lg mb-3 ${settings.gmail_connected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}">
          <div class="text-sm font-medium ${settings.gmail_connected ? 'text-green-700' : 'text-yellow-700'}">
            ${settings.gmail_connected ? '✅ Gmail Connected' : '⚠️ Gmail Not Connected'}
          </div>
          <div class="text-xs text-slate-500 mt-1">
            ${settings.gmail_connected ? 'Emails are being sent and received through Gmail' : 'Connect Gmail to send emails and sync inbox'}
          </div>
        </div>
        <button class="btn btn-primary btn-sm mb-2" onclick="connectGmail()">
          <i class="fab fa-google"></i> ${settings.gmail_connected ? 'Reconnect' : 'Connect'} Gmail
        </button>
        <button class="btn btn-secondary btn-sm" onclick="syncGmail()">
          <i class="fas fa-sync"></i> Sync Inbox
        </button>
        <div class="mt-3 text-xs text-slate-400">
          Requires: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET secrets in Cloudflare
        </div>
      </div>
      
      <!-- QuickBooks -->
      <div class="card">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-calculator text-blue-500 mr-2"></i>QuickBooks Online</h3>
        <div class="p-3 rounded-lg mb-3 ${settings.quickbooks_connected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}">
          <div class="text-sm font-medium ${settings.quickbooks_connected ? 'text-green-700' : 'text-yellow-700'}">
            ${settings.quickbooks_connected ? '✅ QuickBooks Connected' : '⚠️ QuickBooks Not Connected'}
          </div>
          <div class="text-xs text-slate-500 mt-1">
            ${settings.quickbooks_connected ? 'Estimates and invoices sync with QuickBooks' : 'Connect to sync estimates and invoices'}
          </div>
        </div>
        <button class="btn btn-primary btn-sm mb-2" onclick="connectQuickBooks()">
          <i class="fas fa-calculator"></i> ${settings.quickbooks_connected ? 'Reconnect' : 'Connect'} QuickBooks
        </button>
        <div class="mt-3 text-xs text-slate-400">
          Requires: QB_CLIENT_ID, QB_CLIENT_SECRET secrets in Cloudflare
        </div>
      </div>
      
      <!-- Twilio SMS/Voice -->
      <div class="card">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-phone text-green-500 mr-2"></i>Twilio SMS & Voice</h3>
        <div class="p-3 rounded-lg mb-3 ${settings.twilio_connected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}">
          <div class="text-sm font-medium ${settings.twilio_connected ? 'text-green-700' : 'text-yellow-700'}">
            ${settings.twilio_connected ? '✅ Twilio Connected' : '⚠️ Twilio Not Connected'}
          </div>
          <div class="text-xs text-slate-500 mt-1">
            ${settings.twilio_connected ? 'SMS and calls are enabled' : 'Connect Twilio for SMS and call logging'}
          </div>
        </div>
        <div class="space-y-2">
          <div><label class="label">Twilio Phone Number</label>
            <input class="input" id="s-twilio_phone_number" value="${settings.twilio_phone_number || ''}" placeholder="+15555551234">
          </div>
          <button class="btn btn-primary btn-sm" onclick="saveSettings(['twilio_phone_number'])">
            <i class="fas fa-save"></i> Save Phone Number
          </button>
        </div>
        <div class="mt-3 text-xs text-slate-400">
          Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER secrets
        </div>
      </div>
      
      <!-- AI Settings -->
      <div class="card">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-brain text-purple-500 mr-2"></i>AI Analysis</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">AI Deal Analysis</div>
              <div class="text-xs text-slate-400">Auto-analyze deals and suggest actions</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="s-openai_enabled" ${settings.openai_enabled ? 'checked' : ''} class="sr-only peer">
              <div class="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
          <div class="text-xs text-slate-400">
            Requires: OPENAI_API_KEY secret in Cloudflare
          </div>
          <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded">
            The AI uses rule-based analysis when no API key is configured, providing smart stage-based suggestions.
          </div>
        </div>
      </div>
      
      <!-- Business Settings -->
      <div class="card">
        <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-cog text-slate-500 mr-2"></i>Business Settings</h3>
        <div class="space-y-3">
          <div><label class="label">Follow-up Reminder (days)</label>
            <input class="input" id="s-follow_up_reminder_days" type="number" value="${settings.follow_up_reminder_days || 3}">
          </div>
          <div><label class="label">Default Estimate Valid (days)</label>
            <input class="input" id="s-estimate_valid_days" type="number" value="${settings.estimate_valid_days || 30}">
          </div>
          <div><label class="label">Default Invoice Due (days)</label>
            <input class="input" id="s-invoice_due_days" type="number" value="${settings.invoice_due_days || 30}">
          </div>
          <div><label class="label">Default Tax Rate (%)</label>
            <input class="input" id="s-tax_rate_default" type="number" step="0.1" value="${settings.tax_rate_default || 0}">
          </div>
          <button class="btn btn-primary btn-sm" onclick="saveSettings(['follow_up_reminder_days','estimate_valid_days','invoice_due_days','tax_rate_default'])">
            <i class="fas fa-save"></i> Save Settings
          </button>
        </div>
      </div>
    </div>
    
    <!-- Setup Guide -->
    <div class="card mt-6">
      <h3 class="font-semibold text-slate-700 mb-4"><i class="fas fa-rocket text-orange-500 mr-2"></i>Integration Setup Guide</h3>
      <div class="grid gap-4" style="grid-template-columns:1fr 1fr 1fr">
        <div class="p-3 bg-slate-50 rounded-lg">
          <div class="font-semibold text-sm mb-2">1. Gmail Setup</div>
          <div class="text-xs text-slate-500 space-y-1">
            <div>• Go to Google Cloud Console</div>
            <div>• Create OAuth 2.0 credentials</div>
            <div>• Add GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET as Cloudflare secrets</div>
            <div>• Click "Connect Gmail" above</div>
          </div>
        </div>
        <div class="p-3 bg-slate-50 rounded-lg">
          <div class="font-semibold text-sm mb-2">2. Twilio Setup</div>
          <div class="text-xs text-slate-500 space-y-1">
            <div>• Sign up at twilio.com</div>
            <div>• Get a phone number</div>
            <div>• Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER</div>
            <div>• Set webhook URL to /api/communications/twilio-webhook</div>
          </div>
        </div>
        <div class="p-3 bg-slate-50 rounded-lg">
          <div class="font-semibold text-sm mb-2">3. QuickBooks Setup</div>
          <div class="text-xs text-slate-500 space-y-1">
            <div>• Go to developer.intuit.com</div>
            <div>• Create an app with accounting scope</div>
            <div>• Add QB_CLIENT_ID + QB_CLIENT_SECRET</div>
            <div>• Click "Connect QuickBooks" above</div>
          </div>
        </div>
      </div>
    </div>
  `
}

async function saveSettings(keys) {
  const data = {}
  keys.forEach(k => {
    const el = document.getElementById(`s-${k}`)
    if (el) data[k] = el.type === 'checkbox' ? el.checked : el.value
  })
  try {
    await axios.put(`${API}/settings`, data)
    showToast('Settings saved!', 'success')
  } catch(e) { showToast('Error saving settings', 'error') }
}

async function connectGmail() {
  try {
    const { data } = await axios.get(`${API}/gmail/auth-url`)
    if (data.auth_url) {
      window.open(data.auth_url, '_blank', 'width=500,height=600')
    } else {
      showToast(data.error || 'Gmail Client ID not configured', 'error')
    }
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

async function connectQuickBooks() {
  try {
    const { data } = await axios.get(`${API}/quickbooks/auth-url`)
    if (data.auth_url) {
      window.open(data.auth_url, '_blank', 'width=500,height=600')
    } else {
      showToast(data.error || 'QuickBooks not configured', 'error')
    }
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

// ============================================================
// FORMS & MODALS
// ============================================================
function showQuickAdd() { document.getElementById('modal-quick-add').classList.add('open') }

async function showAddContact() {
  const form = document.getElementById('contact-form')
  form.reset()
  form.querySelector('[name=id]').value = ''
  document.getElementById('contact-modal-title').textContent = 'Add Contact'
  document.getElementById('modal-contact').classList.add('open')
}

async function editContact(id) {
  try {
    const { data } = await axios.get(`${API}/contacts/${id}`)
    const c = data.contact
    const form = document.getElementById('contact-form')
    Object.keys(c).forEach(k => { 
      const el = form.querySelector(`[name=${k}]`)
      if (el) el.value = c[k] || ''
    })
    document.getElementById('contact-modal-title').textContent = 'Edit Contact'
    document.getElementById('modal-contact').classList.add('open')
  } catch(e) { showToast('Error loading contact', 'error') }
}

async function saveContact(e) {
  e.preventDefault()
  const form = e.target
  const data = Object.fromEntries(new FormData(form))
  const id = data.id
  delete data.id
  
  try {
    if (id) {
      await axios.put(`${API}/contacts/${id}`, data)
    } else {
      await axios.post(`${API}/contacts`, data)
    }
    showToast(`Contact ${id ? 'updated' : 'created'}!`, 'success')
    closeModal('modal-contact')
    if (state.currentPage === 'contacts') loadContacts()
  } catch(e) { showToast('Error saving contact: ' + e.message, 'error') }
}

async function showAddDeal(stage = 'lead') {
  await loadContactsForSelect('deal-contact-select')
  const form = document.getElementById('deal-form')
  form.reset()
  form.querySelector('[name=id]').value = ''
  form.querySelector('[name=stage]').value = stage
  document.getElementById('deal-modal-title').textContent = 'New Deal'
  document.getElementById('modal-deal').classList.add('open')
}

function showAddDealInStage(stage) {
  showAddDeal(stage)
}

function showAddDealForContact(contactId, contactName) {
  showAddDeal().then(() => {
    const select = document.getElementById('deal-contact-select')
    select.value = contactId
  })
}

async function editDeal(id) {
  try {
    await loadContactsForSelect('deal-contact-select')
    const { data } = await axios.get(`${API}/deals/${id}`)
    const d = data.deal
    const form = document.getElementById('deal-form')
    form.reset()
    Object.keys(d).forEach(k => {
      const el = form.querySelector(`[name=${k}]`)
      if (el) el.value = d[k] || ''
    })
    const cats = JSON.parse(d.product_categories || '[]')
    form.querySelectorAll('.product-cat').forEach(cb => {
      cb.checked = cats.includes(cb.value)
    })
    document.getElementById('deal-modal-title').textContent = 'Edit Deal'
    document.getElementById('modal-deal').classList.add('open')
  } catch(e) { showToast('Error loading deal', 'error') }
}

async function saveDeal(e) {
  e.preventDefault()
  const form = e.target
  const data = Object.fromEntries(new FormData(form))
  const id = data.id
  delete data.id
  
  const cats = [...form.querySelectorAll('.product-cat:checked')].map(cb => cb.value)
  data.product_categories = cats
  
  try {
    if (id) {
      await axios.put(`${API}/deals/${id}`, data)
    } else {
      const resp = await axios.post(`${API}/deals`, data)
      // Auto-generate tasks for new deal
      try { await axios.post(`${API}/tasks/generate`, { deal_id: resp.data.deal.id }) } catch {}
    }
    showToast(`Deal ${id ? 'updated' : 'created'}!`, 'success')
    closeModal('modal-deal')
    if (state.currentPage === 'pipeline') loadPipeline()
    if (state.currentPage === 'dashboard') loadDashboard()
  } catch(e) { showToast('Error saving deal: ' + e.message, 'error') }
}

async function updateDealStage(id, stage) {
  try {
    await axios.patch(`${API}/deals/${id}/stage`, { stage })
    showToast(`Stage updated to: ${STAGE_LABELS[stage]}`, 'success')
    openDealDetail(id)
    if (state.currentPage === 'pipeline') loadPipeline()
    if (state.currentPage === 'dashboard') loadDashboard()
  } catch(e) { showToast('Error updating stage', 'error') }
}

async function analyzeDeal(id) {
  showToast('Running AI analysis...', 'info')
  try {
    const { data } = await axios.post(`${API}/ai/analyze-deal`, { deal_id: id })
    showToast('AI analysis complete!', 'success')
    openDealDetail(id)
  } catch(e) { showToast('AI analysis error', 'error') }
}

async function showAddTask(dealId = null) {
  await loadDealsForSelect('task-deal-select')
  const form = document.getElementById('task-form')
  form.reset()
  if (dealId) form.querySelector('[name=deal_id]').value = dealId
  document.getElementById('modal-task').classList.add('open')
}

async function saveTask(e) {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(e.target))
  try {
    await axios.post(`${API}/tasks`, data)
    showToast('Task created!', 'success')
    closeModal('modal-task')
    if (state.currentPage === 'tasks') loadTasks('pending')
  } catch(e) { showToast('Error creating task', 'error') }
}

function showLogComm() {
  loadContactsForSelect('comm-contact-select')
  loadDealsForSelect('comm-deal-select')
  document.getElementById('modal-comm').classList.add('open')
}

function openCommModal(dealId, contactId) {
  showLogComm()
  setTimeout(() => {
    if (dealId) document.getElementById('comm-deal-select').value = dealId
    if (contactId) document.getElementById('comm-contact-select').value = contactId
  }, 300)
}

function openSMSModal(dealId, contactId) {
  showLogComm()
  setCommType('sms', document.querySelector('#comm-type-tabs .tab-btn'))
  setTimeout(() => {
    if (dealId) document.getElementById('comm-deal-select').value = dealId
    if (contactId) document.getElementById('comm-contact-select').value = contactId
  }, 300)
}

function setCommType(type, btn) {
  state.commType = type
  document.querySelectorAll('#comm-type-tabs .tab-btn').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  
  document.getElementById('comm-email-fields').style.display = type === 'email' ? 'block' : 'none'
  document.getElementById('comm-sms-fields').style.display = type === 'sms' ? 'block' : 'none'
  document.getElementById('comm-call-fields').style.display = type === 'call' ? 'block' : 'none'
  document.getElementById('comm-note-fields').style.display = type === 'note' ? 'block' : 'none'
  
  document.querySelector('[name=comm_type]').value = type
  
  const btnLabels = { email: 'Send Email', sms: 'Send SMS', call: 'Log Call', note: 'Save Note' }
  const icons = { email: 'fa-paper-plane', sms: 'fa-paper-plane', call: 'fa-phone', note: 'fa-save' }
  document.getElementById('comm-submit-btn').innerHTML = `<i class="fas ${icons[type]}"></i> ${btnLabels[type]}`
}

async function saveComm(e) {
  e.preventDefault()
  const formData = new FormData(e.target)
  const data = Object.fromEntries(formData)
  const type = data.comm_type || state.commType
  
  try {
    if (type === 'email') {
      const payload = {
        deal_id: data.deal_id || null,
        contact_id: data.contact_id || null,
        to: data.to,
        subject: data.subject,
        html: data.body,
        body: data.body
      }
      const { data: resp } = await axios.post(`${API}/communications/send-email`, payload)
      showToast(resp.message, resp.success ? 'success' : 'warning')
    } else if (type === 'sms') {
      const payload = {
        deal_id: data.deal_id || null,
        contact_id: data.contact_id || null,
        to: data.sms_to,
        message: data.sms_body
      }
      const { data: resp } = await axios.post(`${API}/communications/send-sms`, payload)
      showToast(resp.message, resp.success ? 'success' : 'warning')
    } else if (type === 'call') {
      await axios.post(`${API}/communications/log-call`, {
        deal_id: data.deal_id || null,
        contact_id: data.contact_id || null,
        direction: data.direction,
        duration_seconds: (parseInt(data.duration || '0') * 60),
        notes: data.call_notes
      })
      showToast('Call logged!', 'success')
    } else {
      await axios.post(`${API}/communications`, {
        deal_id: data.deal_id || null,
        contact_id: data.contact_id || null,
        type: 'note',
        direction: 'internal',
        body: data.note_body,
        status: 'completed'
      })
      showToast('Note saved!', 'success')
    }
    closeModal('modal-comm')
    if (state.currentPage === 'communications') loadCommunications()
  } catch(err) { showToast('Error: ' + err.message, 'error') }
}

function quickEmail(contactId, email, firstName) {
  showLogComm()
  setCommType('email', null)
  setTimeout(() => {
    if (contactId) document.getElementById('comm-contact-select').value = contactId
    if (email) document.querySelector('[name=to]').value = email
  }, 300)
}

function quickSMS(contactId, phone) {
  showLogComm()
  setCommType('sms', null)
  setTimeout(() => {
    if (contactId) document.getElementById('comm-contact-select').value = contactId
    if (phone) document.querySelector('[name=sms_to]').value = phone
  }, 300)
}

// Purchase Order Form
let poLineItemCount = 0
function showCreatePO() {
  loadSuppliersForSelect('po-supplier-select')
  loadDealsForSelect('po-deal-select')
  poLineItemCount = 0
  document.getElementById('po-line-items').innerHTML = ''
  document.getElementById('po-form').reset()
  addPOLineItem()
  document.getElementById('modal-po').classList.add('open')
}

function openCreatePOModal(dealId) {
  showCreatePO()
  setTimeout(() => {
    if (dealId) document.getElementById('po-deal-select').value = dealId
  }, 300)
}

function addPOLineItem() {
  const container = document.getElementById('po-line-items')
  const idx = poLineItemCount++
  const div = document.createElement('div')
  div.className = 'flex gap-2 mb-2 items-start'
  div.innerHTML = `
    <input placeholder="Item description" class="input flex-1" id="po-item-desc-${idx}">
    <input type="number" placeholder="Qty" class="input" style="width:60px" id="po-item-qty-${idx}" value="1" oninput="updatePOTotal()">
    <input type="number" placeholder="Unit Price" class="input" style="width:100px" id="po-item-price-${idx}" oninput="updatePOTotal()">
    <button type="button" class="btn btn-xs btn-danger" onclick="this.parentElement.remove();updatePOTotal()"><i class="fas fa-times"></i></button>
  `
  container.appendChild(div)
}

function updatePOTotal() {
  let subtotal = 0
  for (let i = 0; i < poLineItemCount; i++) {
    const qty = parseFloat(document.getElementById(`po-item-qty-${i}`)?.value || 0)
    const price = parseFloat(document.getElementById(`po-item-price-${i}`)?.value || 0)
    if (!isNaN(qty) && !isNaN(price)) subtotal += qty * price
  }
  const shipping = parseFloat(document.querySelector('[name=shipping_amount]')?.value || 0)
  const total = subtotal + shipping
  const subtotalEl = document.getElementById('po-subtotal')
  const totalEl = document.getElementById('po-total')
  if (subtotalEl) subtotalEl.value = subtotal.toFixed(2)
  if (totalEl) totalEl.value = total.toFixed(2)
}

async function savePO(e) {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(e.target))
  
  // Collect line items
  const lineItems = []
  for (let i = 0; i < poLineItemCount; i++) {
    const desc = document.getElementById(`po-item-desc-${i}`)?.value
    const qty = document.getElementById(`po-item-qty-${i}`)?.value
    const price = document.getElementById(`po-item-price-${i}`)?.value
    if (desc) lineItems.push({ description: desc, quantity: parseFloat(qty || 1), unit_price: parseFloat(price || 0) })
  }
  
  data.line_items = lineItems
  
  try {
    await axios.post(`${API}/purchase-orders`, data)
    showToast('Purchase Order created!', 'success')
    closeModal('modal-po')
    if (state.currentPage === 'purchase-orders') loadPurchaseOrders()
  } catch(e) { showToast('Error: ' + e.message, 'error') }
}

async function requestQuote(poId) {
  try {
    const { data } = await axios.post(`${API}/purchase-orders/${poId}/request-quote`)
    showToast(data.message, 'success')
    loadPurchaseOrders()
  } catch(e) { showToast('Error requesting quote', 'error') }
}

function showAddTracking(poId) {
  document.getElementById('tracking-form').reset()
  document.querySelector('#tracking-form [name=po_id]').value = poId
  document.getElementById('modal-tracking').classList.add('open')
}

async function saveTracking(e) {
  e.preventDefault()
  const data = Object.fromEntries(new FormData(e.target))
  try {
    const { data: resp } = await axios.post(`${API}/purchase-orders/${data.po_id}/add-tracking`, {
      carrier: data.carrier,
      tracking_number: data.tracking_number
    })
    showToast(`Tracking added! Customer will be notified.`, 'success')
    closeModal('modal-tracking')
    loadPurchaseOrders()
  } catch(e) { showToast('Error adding tracking', 'error') }
}

async function editPOStatus(id) {
  const newStatus = prompt('New status: draft, quote_requested, quote_received, approved, submitted, confirmed, in_production, shipped, received, cancelled')
  if (!newStatus) return
  try {
    await axios.put(`${API}/purchase-orders/${id}`, { status: newStatus })
    showToast('PO status updated!', 'success')
    loadPurchaseOrders()
  } catch(e) { showToast('Error updating PO', 'error') }
}

function openCreateEstimateModal(dealId) {
  // Simple create estimate
  const total = prompt('Enter estimate total amount ($):')
  if (!total) return
  const notes = prompt('Notes (optional):') || ''
  axios.post(`${API}/estimates`, { deal_id: dealId, total: parseFloat(total), subtotal: parseFloat(total), notes }).then(({ data }) => {
    showToast(`Estimate ${data.estimate.estimate_number} created!`, 'success')
    if (state.currentDeal) openDealDetail(dealId)
  })
}

function openCreateInvoiceModal(dealId) {
  const total = prompt('Enter invoice total amount ($):')
  if (!total) return
  axios.post(`${API}/invoices`, { deal_id: dealId, total: parseFloat(total), subtotal: parseFloat(total) }).then(({ data }) => {
    showToast(`Invoice ${data.invoice.invoice_number} created!`, 'success')
    if (state.currentDeal) openDealDetail(dealId)
  })
}

function showCreateEstimate() {
  showPage('pipeline')
}

function showCreateInvoice() {
  showPage('pipeline')
}

function showAddCompany() {
  const name = prompt('Company name:')
  if (!name) return
  const type = prompt('Type (customer, prospect, supplier):') || 'customer'
  axios.post(`${API}/companies`, { name, type }).then(() => {
    showToast('Company added!', 'success')
    loadCompanies()
  })
}

function editCompany(id) {
  showToast('Edit company - coming soon', 'info')
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function markNotifRead(id) {
  await axios.patch(`${API}/notifications/${id}/read`)
  loadDashboard()
}

async function markAllNotifRead() {
  await axios.patch(`${API}/notifications/mark-all-read`)
  showToast('All notifications marked as read', 'success')
  loadDashboard()
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge')
  const dot = document.getElementById('header-notif-dot')
  if (count > 0) {
    badge.textContent = count
    badge.classList.remove('hidden')
    dot.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
    dot.classList.add('hidden')
  }
}

function updateTasksBadge(count) {
  const badge = document.getElementById('tasks-badge')
  if (count > 0) {
    badge.textContent = count
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
}

// ============================================================
// SEARCH
// ============================================================
let searchTimeout = null
function handleSearch(q) {
  clearTimeout(searchTimeout)
  const resultsEl = document.getElementById('search-results')
  
  if (!q || q.length < 2) { resultsEl.classList.add('hidden'); return }
  
  searchTimeout = setTimeout(async () => {
    try {
      const { data } = await axios.get(`${API}/search`, { params: { q } })
      if (data.results.length) {
        resultsEl.innerHTML = data.results.map(r => `
          <div class="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer" onclick="handleSearchResult('${r.type}', ${r.id})">
            <div class="w-7 h-7 rounded-full flex items-center justify-content-center text-xs font-semibold text-white" 
              style="display:flex;align-items:center;justify-content:center;background:${r.type === 'contact' ? '#6366f1' : r.type === 'deal' ? '#22c55e' : '#f59e0b'}">
              ${r.type[0].toUpperCase()}
            </div>
            <div>
              <div class="text-sm font-medium">${r.title}</div>
              <div class="text-xs text-slate-400">${r.type} · ${r.subtitle || ''}</div>
            </div>
          </div>
        `).join('')
        resultsEl.classList.remove('hidden')
      } else {
        resultsEl.innerHTML = '<div class="p-3 text-slate-400 text-sm">No results found</div>'
        resultsEl.classList.remove('hidden')
      }
    } catch(e) {}
  }, 300)
}

function handleSearchResult(type, id) {
  document.getElementById('search-results').classList.add('hidden')
  document.getElementById('global-search').value = ''
  if (type === 'contact') { showPage('contacts'); setTimeout(() => openContactDetail(id), 300) }
  else if (type === 'deal') { showPage('pipeline'); setTimeout(() => openDealDetail(id), 300) }
  else if (type === 'company') { showPage('companies') }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#global-search') && !e.target.closest('#search-results')) {
    document.getElementById('search-results').classList.add('hidden')
  }
})

// ============================================================
// HELPERS
// ============================================================
async function loadContactsForSelect(selectId) {
  try {
    const { data } = await axios.get(`${API}/contacts`, { params: { limit: 200 } })
    const select = document.getElementById(selectId)
    const current = select.value
    select.innerHTML = '<option value="">Select Contact...</option>' + 
      data.contacts.map(c => `<option value="${c.id}">${c.first_name} ${c.last_name}${c.company_name ? ' - ' + c.company_name : ''}</option>`).join('')
    if (current) select.value = current
  } catch(e) {}
}

async function loadDealsForSelect(selectId) {
  try {
    const { data } = await axios.get(`${API}/deals`, { params: { limit: 200, status: 'active' } })
    const select = document.getElementById(selectId)
    const current = select.value
    select.innerHTML = '<option value="">None</option>' + 
      data.deals.map(d => `<option value="${d.id}">${d.title}</option>`).join('')
    if (current) select.value = current
  } catch(e) {}
}

async function loadSuppliersForSelect(selectId) {
  try {
    const { data } = await axios.get(`${API}/suppliers`)
    const select = document.getElementById(selectId)
    select.innerHTML = '<option value="">Select Supplier...</option>' + 
      data.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
  } catch(e) {}
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open')
}

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open') })
})

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container')
  const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#6366f1' }
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' }
  
  const toast = document.createElement('div')
  toast.className = 'toast-item'
  toast.style.background = colors[type] || colors.info
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`
  container.appendChild(toast)
  
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300) }, 4000)
}

function getTypeColor(type) {
  const colors = { lead: '#6B7280', prospect: '#3B82F6', customer: '#22C55E', supplier: '#F59E0B' }
  return colors[type] || '#6B7280'
}

function getNotifColor(type) {
  const colors = { payment_received: 'bg-green-500', shipment_update: 'bg-blue-500', deal_update: 'bg-indigo-500', task_due: 'bg-orange-500', inbound_sms: 'bg-purple-500' }
  return colors[type] || 'bg-slate-500'
}

function getActionIcon(action) {
  const icons = { created: 'fa-plus', stage_changed: 'fa-arrow-right', email_logged: 'fa-envelope', call_logged: 'fa-phone', invoice_paid: 'fa-dollar-sign', sms_logged: 'fa-sms', note_logged: 'fa-sticky-note', updated: 'fa-edit' }
  return icons[action] || 'fa-circle'
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
  return date.toLocaleDateString()
}

function fmtNum(n) {
  const num = parseFloat(n) || 0
  if (num >= 1000000) return (num/1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num/1000).toFixed(0) + 'K'
  return num.toFixed(0)
}

function showTaskActions(id) {
  // Placeholder for task actions
}

async function loadDeals() {
  if (state.currentPage === 'pipeline') loadPipeline()
}

// ============================================================
// INITIALIZATION
// ============================================================
async function initApp() {
  // Init DB if needed
  try {
    await axios.get(`${API}/dashboard`)
  } catch (e) {
    if (e.response?.status === 503) {
      document.querySelector('main').innerHTML = `
        <div class="flex items-center justify-center min-h-screen">
          <div class="card text-center" style="max-width:500px">
            <i class="fas fa-horse text-indigo-500 text-5xl mb-4"></i>
            <h2 class="text-xl font-bold mb-2">Setting Up Database...</h2>
            <p class="text-slate-500 mb-4">The database needs to be initialized. Please run migrations.</p>
            <code class="block bg-slate-50 p-3 rounded text-sm text-left">
              npx wrangler d1 migrations apply amberway-crm-production --local
            </code>
          </div>
        </div>
      `
      return
    }
  }
  
  loadDashboard()
  
  // Refresh dashboard every 5 minutes
  setInterval(loadDashboard, 5 * 60 * 1000)
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp)
