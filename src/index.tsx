// Amberway Equine CRM - Main Application Entry
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './types'

import contactsRoutes from './routes/contacts'
import dealsRoutes from './routes/deals'
import communicationsRoutes from './routes/communications'
import tasksRoutes from './routes/tasks'
import purchaseOrdersRoutes from './routes/purchase-orders'
import apiRoutes from './routes/api'

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Static files
app.use('/static/*', serveStatic({ root: './' }))

// DB initialization middleware
app.use('/api/*', async (c, next) => {
  const { DB } = c.env
  if (!DB) {
    return c.json({ error: 'Database not initialized. Run migrations first.' }, 503)
  }
  await next()
})

// API Routes
app.route('/api/contacts', contactsRoutes)
app.route('/api/deals', dealsRoutes)
app.route('/api/communications', communicationsRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/purchase-orders', purchaseOrdersRoutes)
app.route('/api', apiRoutes)

// SPA - serve the main HTML app for all routes
app.get('*', (c) => {
  return c.html(getAppHTML())
})

function getAppHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Amberway Equine CRM</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f8fafc; }
    .sidebar { width: 260px; min-height: 100vh; background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%); }
    .sidebar-link { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 8px; color: #94a3b8; text-decoration: none; transition: all 0.2s; font-size: 14px; margin: 2px 8px; }
    .sidebar-link:hover, .sidebar-link.active { background: rgba(99,102,241,0.2); color: #e2e8f0; }
    .sidebar-link.active { background: rgba(99,102,241,0.3); color: #fff; border-left: 3px solid #6366f1; }
    .sidebar-link i { width: 20px; text-align: center; }
    .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; font-size: 11px; font-weight: 600; }
    .card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); border: 1px solid #f1f5f9; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-success { background: #22c55e; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-warning { background: #f59e0b; color: white; }
    .btn-sm { padding: 5px 10px; font-size: 13px; }
    .btn-xs { padding: 3px 8px; font-size: 12px; }
    .input { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; transition: border 0.2s; background: white; }
    .input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .select { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; background: white; }
    .label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .modal { display: none; position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
    .modal.open { display: flex; }
    .modal-box { background: white; border-radius: 16px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 24px; }
    .modal-box-lg { max-width: 900px; }
    .tab-btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; color: #6b7280; background: transparent; }
    .tab-btn.active { background: #6366f1; color: white; }
    .stage-badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 100px; font-size: 12px; font-weight: 500; }
    .priority-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .kanban-col { min-width: 220px; max-width: 220px; }
    .kanban-card { background: white; border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; border: 1px solid #f1f5f9; transition: box-shadow 0.2s; }
    .kanban-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .timeline-item { position: relative; padding-left: 24px; padding-bottom: 16px; }
    .timeline-item::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: -8px; width: 2px; background: #e2e8f0; }
    .timeline-item:last-child::before { display: none; }
    .timeline-dot { position: absolute; left: 0; top: 4px; width: 16px; height: 16px; border-radius: 50%; background: #6366f1; border: 2px solid white; box-shadow: 0 0 0 2px #6366f1; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .page { display: none; }
    .page.active { display: block; }
    .notification-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; position: absolute; top: -2px; right: -2px; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: skeleton 1.5s infinite; border-radius: 6px; }
    @keyframes skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .toast { position: fixed; bottom: 24px; right: 24px; z-index: 9999; }
    .toast-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; margin-top: 8px; color: white; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease; }
    @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .deal-value { font-size: 13px; color: #22c55e; font-weight: 600; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
    @media (max-width: 768px) { .sidebar { display: none; } .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }
  </style>
</head>
<body class="flex">

<!-- SIDEBAR -->
<nav class="sidebar flex flex-col py-4 flex-shrink-0">
  <div class="px-5 mb-6">
    <div class="flex items-center gap-3">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center">
        <i class="fas fa-horse text-white text-sm"></i>
      </div>
      <div>
        <div class="text-white font-bold text-sm leading-tight">Amberway Equine</div>
        <div class="text-slate-400 text-xs">CRM System</div>
      </div>
    </div>
  </div>

  <div class="px-3 mb-2">
    <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-1">Main</div>
  </div>
  <a href="#" class="sidebar-link active" onclick="showPage('dashboard')">
    <i class="fas fa-chart-line"></i> Dashboard
    <span id="notif-badge" class="badge bg-red-500 text-white ml-auto hidden">0</span>
  </a>
  <a href="#" class="sidebar-link" onclick="showPage('pipeline')">
    <i class="fas fa-columns"></i> Pipeline
  </a>
  <a href="#" class="sidebar-link" onclick="showPage('contacts')">
    <i class="fas fa-users"></i> Contacts
  </a>
  <a href="#" class="sidebar-link" onclick="showPage('companies')">
    <i class="fas fa-building"></i> Companies
  </a>

  <div class="px-3 mt-4 mb-2">
    <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-1">Finance</div>
  </div>
  <a href="#" class="sidebar-link" onclick="showPage('estimates')">
    <i class="fas fa-file-invoice"></i> Estimates
  </a>
  <a href="#" class="sidebar-link" onclick="showPage('invoices')">
    <i class="fas fa-dollar-sign"></i> Invoices
  </a>

  <div class="px-3 mt-4 mb-2">
    <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-1">Orders</div>
  </div>
  <a href="#" class="sidebar-link" onclick="showPage('purchase-orders')">
    <i class="fas fa-shopping-cart"></i> Purchase Orders
  </a>
  <a href="#" class="sidebar-link" onclick="showPage('shipments')">
    <i class="fas fa-truck"></i> Shipments
  </a>

  <div class="px-3 mt-4 mb-2">
    <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-1">Productivity</div>
  </div>
  <a href="#" class="sidebar-link" onclick="showPage('tasks')">
    <i class="fas fa-tasks"></i> Tasks
    <span id="tasks-badge" class="badge bg-orange-500 text-white ml-auto hidden">0</span>
  </a>
  <a href="#" class="sidebar-link" onclick="showPage('communications')">
    <i class="fas fa-comments"></i> Communications
  </a>

  <div class="mt-auto">
    <div class="px-3 mb-2">
      <div class="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-1">System</div>
    </div>
    <a href="#" class="sidebar-link" onclick="showPage('settings')">
      <i class="fas fa-cog"></i> Settings
    </a>
  </div>
</nav>

<!-- MAIN CONTENT -->
<main class="flex-1 flex flex-col min-h-screen" style="max-width:calc(100vw - 260px)">
  <!-- TOP BAR -->
  <header class="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
    <div class="flex items-center gap-3 flex-1">
      <div class="relative flex-1 max-w-md">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input type="text" id="global-search" placeholder="Search contacts, deals, companies..." 
          class="input pl-9" style="padding-left:36px" oninput="handleSearch(this.value)">
        <div id="search-results" class="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg hidden z-50 max-h-80 overflow-y-auto"></div>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button class="btn btn-primary btn-sm" onclick="showQuickAdd()">
        <i class="fas fa-plus"></i> Quick Add
      </button>
      <button class="relative btn btn-secondary btn-sm" onclick="showPage('tasks')">
        <i class="fas fa-bell"></i>
        <span id="header-notif-dot" class="notification-dot hidden"></span>
      </button>
      <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">AE</div>
    </div>
  </header>

  <!-- PAGES CONTAINER -->
  <div class="flex-1 overflow-y-auto p-6">

    <!-- DASHBOARD PAGE -->
    <div id="page-dashboard" class="page active">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="syncGmail()">
            <i class="fab fa-google"></i> Sync Gmail
          </button>
          <button class="btn btn-primary btn-sm" onclick="showAddDeal()">
            <i class="fas fa-plus"></i> New Deal
          </button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div id="kpi-cards" class="grid-4 mb-6">
        <div class="skeleton h-24"></div>
        <div class="skeleton h-24"></div>
        <div class="skeleton h-24"></div>
        <div class="skeleton h-24"></div>
      </div>

      <div class="grid gap-6" style="grid-template-columns:1fr 1fr">
        <!-- Pipeline overview -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-700">Pipeline by Stage</h3>
            <button class="btn btn-secondary btn-xs" onclick="showPage('pipeline')">View All</button>
          </div>
          <canvas id="pipelineChart" height="180"></canvas>
        </div>

        <!-- Revenue Trend -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-700">Revenue Trend</h3>
          </div>
          <canvas id="revenueChart" height="180"></canvas>
        </div>
      </div>

      <div class="grid gap-6 mt-6" style="grid-template-columns:1fr 1fr">
        <!-- Tasks due today + overdue -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-700 flex items-center gap-2">
              <i class="fas fa-exclamation-triangle text-orange-500"></i> Tasks Needing Attention
            </h3>
            <button class="btn btn-secondary btn-xs" onclick="showPage('tasks')">All Tasks</button>
          </div>
          <div id="dash-tasks"></div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-700">Recent Activity</h3>
          </div>
          <div id="dash-activity" class="space-y-2 max-h-80 overflow-y-auto"></div>
        </div>
      </div>

      <div class="grid gap-6 mt-6" style="grid-template-columns:1fr 1fr">
        <!-- Active POs -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-700 flex items-center gap-2">
              <i class="fas fa-shopping-cart text-blue-500"></i> Active Orders
            </h3>
            <button class="btn btn-secondary btn-xs" onclick="showPage('purchase-orders')">All POs</button>
          </div>
          <div id="dash-pos"></div>
        </div>

        <!-- Notifications -->
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-700 flex items-center gap-2">
              <i class="fas fa-bell text-indigo-500"></i> Notifications
            </h3>
            <button class="btn btn-xs btn-secondary" onclick="markAllNotifRead()">Mark All Read</button>
          </div>
          <div id="dash-notifications" class="space-y-2 max-h-80 overflow-y-auto"></div>
        </div>
      </div>
    </div>

    <!-- PIPELINE PAGE -->
    <div id="page-pipeline" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Pipeline</h1>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="loadDeals()"><i class="fas fa-sync"></i></button>
          <button class="btn btn-primary btn-sm" onclick="showAddDeal()"><i class="fas fa-plus"></i> New Deal</button>
        </div>
      </div>
      <div id="pipeline-kanban" class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide" style="min-height:500px"></div>
    </div>

    <!-- CONTACTS PAGE -->
    <div id="page-contacts" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Contacts</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddContact()"><i class="fas fa-plus"></i> Add Contact</button>
      </div>
      <div class="card mb-4">
        <div class="flex gap-3">
          <input type="text" id="contact-search" placeholder="Search contacts..." class="input" oninput="filterContacts(this.value)">
          <select class="select" style="width:150px" onchange="filterContactsByType(this.value)">
            <option value="">All Types</option>
            <option value="lead">Leads</option>
            <option value="customer">Customers</option>
            <option value="prospect">Prospects</option>
          </select>
        </div>
      </div>
      <div id="contacts-list"></div>
    </div>

    <!-- COMPANIES PAGE -->
    <div id="page-companies" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Companies</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddCompany()"><i class="fas fa-plus"></i> Add Company</button>
      </div>
      <div id="companies-list"></div>
    </div>

    <!-- ESTIMATES PAGE -->
    <div id="page-estimates" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Estimates</h1>
        <button class="btn btn-primary btn-sm" onclick="showCreateEstimate()"><i class="fas fa-plus"></i> Create Estimate</button>
      </div>
      <div id="estimates-list"></div>
    </div>

    <!-- INVOICES PAGE -->
    <div id="page-invoices" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Invoices</h1>
        <button class="btn btn-primary btn-sm" onclick="showCreateInvoice()"><i class="fas fa-plus"></i> Create Invoice</button>
      </div>
      <div id="invoices-list"></div>
    </div>

    <!-- PURCHASE ORDERS PAGE -->
    <div id="page-purchase-orders" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Purchase Orders</h1>
        <button class="btn btn-primary btn-sm" onclick="showCreatePO()"><i class="fas fa-plus"></i> New PO</button>
      </div>
      <div id="po-list"></div>
    </div>

    <!-- SHIPMENTS PAGE -->
    <div id="page-shipments" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Shipments & Tracking</h1>
      </div>
      <div id="shipments-list"></div>
    </div>

    <!-- TASKS PAGE -->
    <div id="page-tasks" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Tasks & Reminders</h1>
        <button class="btn btn-primary btn-sm" onclick="showAddTask()"><i class="fas fa-plus"></i> Add Task</button>
      </div>
      <div class="flex gap-2 mb-4">
        <button class="tab-btn active" onclick="filterTasks('pending', this)">Pending</button>
        <button class="tab-btn" onclick="filterTasks('in_progress', this)">In Progress</button>
        <button class="tab-btn" onclick="filterTasks('completed', this)">Completed</button>
        <button class="tab-btn" onclick="filterTasks('all', this)">All</button>
      </div>
      <div id="tasks-list"></div>
    </div>

    <!-- COMMUNICATIONS PAGE -->
    <div id="page-communications" class="page">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Communications</h1>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="syncGmail()"><i class="fab fa-google"></i> Sync Gmail</button>
          <button class="btn btn-primary btn-sm" onclick="showLogComm()"><i class="fas fa-plus"></i> Log Communication</button>
        </div>
      </div>
      <div id="communications-list"></div>
    </div>

    <!-- SETTINGS PAGE -->
    <div id="page-settings" class="page">
      <h1 class="text-2xl font-bold text-slate-800 mb-6">Settings & Integrations</h1>
      <div id="settings-content"></div>
    </div>

  </div>
</main>

<!-- TOAST CONTAINER -->
<div class="toast" id="toast-container"></div>

<!-- MODALS -->
<!-- Quick Add Modal -->
<div class="modal" id="modal-quick-add">
  <div class="modal-box" style="max-width:400px">
    <h3 class="text-lg font-bold mb-4">Quick Add</h3>
    <div class="space-y-3">
      <button class="w-full btn btn-secondary text-left" onclick="closeModal('modal-quick-add');showAddContact()">
        <i class="fas fa-user text-blue-500"></i> New Contact
      </button>
      <button class="w-full btn btn-secondary text-left" onclick="closeModal('modal-quick-add');showAddDeal()">
        <i class="fas fa-handshake text-green-500"></i> New Deal
      </button>
      <button class="w-full btn btn-secondary text-left" onclick="closeModal('modal-quick-add');showAddTask()">
        <i class="fas fa-tasks text-orange-500"></i> New Task
      </button>
      <button class="w-full btn btn-secondary text-left" onclick="closeModal('modal-quick-add');showLogComm()">
        <i class="fas fa-comment text-purple-500"></i> Log Communication
      </button>
    </div>
    <button class="btn btn-secondary w-full mt-4" onclick="closeModal('modal-quick-add')">Cancel</button>
  </div>
</div>

<!-- Contact Modal -->
<div class="modal" id="modal-contact">
  <div class="modal-box modal-box-lg">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold" id="contact-modal-title">Add Contact</h3>
      <button onclick="closeModal('modal-contact')" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
    </div>
    <form id="contact-form" onsubmit="saveContact(event)">
      <div class="grid-2 mb-4">
        <div><label class="label">First Name *</label><input name="first_name" class="input" required></div>
        <div><label class="label">Last Name *</label><input name="last_name" class="input" required></div>
      </div>
      <div class="grid-2 mb-4">
        <div><label class="label">Email</label><input name="email" type="email" class="input"></div>
        <div><label class="label">Phone</label><input name="phone" class="input" placeholder="(555) 000-0000"></div>
      </div>
      <div class="grid-2 mb-4">
        <div><label class="label">Mobile</label><input name="mobile" class="input"></div>
        <div><label class="label">Title/Role</label><input name="title" class="input" placeholder="Barn Manager, Owner, etc."></div>
      </div>
      <div class="grid-2 mb-4">
        <div><label class="label">Type</label>
          <select name="type" class="select">
            <option value="lead">Lead</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
          </select>
        </div>
        <div><label class="label">Source</label>
          <select name="source" class="select">
            <option value="">Unknown</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
            <option value="trade_show">Trade Show</option>
            <option value="cold_call">Cold Call</option>
            <option value="email">Email</option>
            <option value="social_media">Social Media</option>
            <option value="design_center">Design Center</option>
          </select>
        </div>
      </div>
      <div class="grid-2 mb-4">
        <div><label class="label">City</label><input name="city" class="input"></div>
        <div><label class="label">State</label><input name="state" class="input" placeholder="FL, KY..."></div>
      </div>
      <div class="mb-4">
        <label class="label">Preferred Contact</label>
        <select name="preferred_contact" class="select">
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="text">Text/SMS</option>
        </select>
      </div>
      <div class="mb-4">
        <label class="label">Notes</label>
        <textarea name="notes" class="input" rows="3" placeholder="Any relevant info about this contact..."></textarea>
      </div>
      <input type="hidden" name="id">
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-contact')">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Contact</button>
      </div>
    </form>
  </div>
</div>

<!-- Deal Modal -->
<div class="modal" id="modal-deal">
  <div class="modal-box modal-box-lg">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold" id="deal-modal-title">New Deal</h3>
      <button onclick="closeModal('modal-deal')" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
    </div>
    <form id="deal-form" onsubmit="saveDeal(event)">
      <div class="mb-4">
        <label class="label">Deal Title *</label>
        <input name="title" class="input" required placeholder="e.g., Wellington Farm - 12 Stall Barn">
      </div>
      <div class="grid-2 mb-4">
        <div>
          <label class="label">Contact</label>
          <select name="contact_id" class="select" id="deal-contact-select">
            <option value="">Select Contact...</option>
          </select>
        </div>
        <div>
          <label class="label">Value ($)</label>
          <input name="value" type="number" class="input" placeholder="0" step="0.01">
        </div>
      </div>
      <div class="grid-2 mb-4">
        <div><label class="label">Stage</label>
          <select name="stage" class="select">
            <option value="lead">New Lead</option>
            <option value="qualified">Qualified</option>
            <option value="proposal_sent">Proposal Sent</option>
            <option value="estimate_sent">Estimate Sent</option>
            <option value="estimate_accepted">Estimate Accepted</option>
            <option value="invoice_sent">Invoice Sent</option>
            <option value="invoice_paid">Invoice Paid</option>
            <option value="order_placed">Order Placed</option>
            <option value="order_confirmed">Order Confirmed</option>
            <option value="shipping">Shipping</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div><label class="label">Priority</label>
          <select name="priority" class="select">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div class="mb-4">
        <label class="label">Products of Interest</label>
        <div class="flex flex-wrap gap-2" id="product-categories">
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="stalls_gates" class="product-cat"> Stalls & Gates</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="fencing" class="product-cat"> Fencing</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="lighting" class="product-cat"> Lighting</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="flooring" class="product-cat"> Flooring</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="fans_ventilation" class="product-cat"> Fans/Ventilation</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="horse_walkers" class="product-cat"> Horse Walkers</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="treadmills" class="product-cat"> Treadmills</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="arenas" class="product-cat"> Arena</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="fly_systems" class="product-cat"> Fly Systems</label>
          <label class="flex items-center gap-1 cursor-pointer"><input type="checkbox" value="therapeutic" class="product-cat"> Therapeutic</label>
        </div>
      </div>
      <div class="grid-2 mb-4">
        <div><label class="label">Expected Close Date</label><input name="expected_close_date" type="date" class="input"></div>
        <div><label class="label">Probability (%)</label><input name="probability" type="number" class="input" placeholder="50" min="0" max="100"></div>
      </div>
      <div class="mb-4">
        <label class="label">Notes</label>
        <textarea name="notes" class="input" rows="3"></textarea>
      </div>
      <input type="hidden" name="id">
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-deal')">Cancel</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Deal</button>
      </div>
    </form>
  </div>
</div>

<!-- Deal Detail Modal -->
<div class="modal" id="modal-deal-detail">
  <div class="modal-box" style="max-width:1000px;width:95vw">
    <div id="deal-detail-content"></div>
  </div>
</div>

<!-- Task Modal -->
<div class="modal" id="modal-task">
  <div class="modal-box">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">Add Task</h3>
      <button onclick="closeModal('modal-task')" class="text-slate-400">&times;</button>
    </div>
    <form id="task-form" onsubmit="saveTask(event)">
      <div class="mb-3"><label class="label">Title *</label><input name="title" class="input" required></div>
      <div class="grid-2 mb-3">
        <div><label class="label">Type</label>
          <select name="type" class="select">
            <option value="follow_up">Follow Up</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="quote_request">Quote Request</option>
            <option value="order_check">Order Check</option>
            <option value="delivery_check">Delivery Check</option>
          </select>
        </div>
        <div><label class="label">Priority</label>
          <select name="priority" class="select">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div class="grid-2 mb-3">
        <div><label class="label">Due Date</label><input name="due_date" type="datetime-local" class="input"></div>
        <div>
          <label class="label">Related Deal</label>
          <select name="deal_id" class="select" id="task-deal-select">
            <option value="">None</option>
          </select>
        </div>
      </div>
      <div class="mb-3"><label class="label">Description</label><textarea name="description" class="input" rows="2"></textarea></div>
      <input type="hidden" name="id">
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-task')">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Task</button>
      </div>
    </form>
  </div>
</div>

<!-- Communication Modal -->
<div class="modal" id="modal-comm">
  <div class="modal-box modal-box-lg">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">Log / Send Communication</h3>
      <button onclick="closeModal('modal-comm')" class="text-slate-400">&times;</button>
    </div>
    <div class="flex gap-2 mb-4" id="comm-type-tabs">
      <button class="tab-btn active" onclick="setCommType('email', this)"><i class="fas fa-envelope"></i> Email</button>
      <button class="tab-btn" onclick="setCommType('sms', this)"><i class="fas fa-sms"></i> SMS</button>
      <button class="tab-btn" onclick="setCommType('call', this)"><i class="fas fa-phone"></i> Call</button>
      <button class="tab-btn" onclick="setCommType('note', this)"><i class="fas fa-sticky-note"></i> Note</button>
    </div>
    <form id="comm-form" onsubmit="saveComm(event)">
      <div class="grid-2 mb-3">
        <div>
          <label class="label">Contact</label>
          <select name="contact_id" class="select" id="comm-contact-select">
            <option value="">Select Contact...</option>
          </select>
        </div>
        <div>
          <label class="label">Related Deal</label>
          <select name="deal_id" class="select" id="comm-deal-select">
            <option value="">None</option>
          </select>
        </div>
      </div>
      <div id="comm-email-fields">
        <div class="mb-3"><label class="label">To (email)</label><input name="to" class="input" type="email"></div>
        <div class="mb-3"><label class="label">Subject</label><input name="subject" class="input"></div>
        <div class="mb-3"><label class="label">Message</label><textarea name="body" class="input" rows="5"></textarea></div>
      </div>
      <div id="comm-sms-fields" style="display:none">
        <div class="mb-3"><label class="label">To (phone)</label><input name="sms_to" class="input"></div>
        <div class="mb-3"><label class="label">Message</label><textarea name="sms_body" class="input" rows="3"></textarea></div>
      </div>
      <div id="comm-call-fields" style="display:none">
        <div class="grid-2 mb-3">
          <div><label class="label">Direction</label>
            <select name="direction" class="select">
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
          <div><label class="label">Duration (min)</label><input name="duration" type="number" class="input" placeholder="5"></div>
        </div>
        <div class="mb-3"><label class="label">Call Notes</label><textarea name="call_notes" class="input" rows="3"></textarea></div>
      </div>
      <div id="comm-note-fields" style="display:none">
        <div class="mb-3"><label class="label">Note</label><textarea name="note_body" class="input" rows="4"></textarea></div>
      </div>
      <input type="hidden" name="comm_type" value="email">
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-comm')">Cancel</button>
        <button type="submit" class="btn btn-primary" id="comm-submit-btn"><i class="fas fa-paper-plane"></i> Send Email</button>
      </div>
    </form>
  </div>
</div>

<!-- PO Modal -->
<div class="modal" id="modal-po">
  <div class="modal-box modal-box-lg">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">Create Purchase Order</h3>
      <button onclick="closeModal('modal-po')" class="text-slate-400">&times;</button>
    </div>
    <form id="po-form" onsubmit="savePO(event)">
      <div class="grid-2 mb-3">
        <div>
          <label class="label">Supplier *</label>
          <select name="supplier_id" class="select" id="po-supplier-select">
            <option value="">Select Supplier...</option>
          </select>
        </div>
        <div>
          <label class="label">Related Deal</label>
          <select name="deal_id" class="select" id="po-deal-select">
            <option value="">None</option>
          </select>
        </div>
      </div>
      <div class="mb-3">
        <label class="label">Line Items</label>
        <div id="po-line-items"></div>
        <button type="button" class="btn btn-secondary btn-sm mt-2" onclick="addPOLineItem()">
          <i class="fas fa-plus"></i> Add Item
        </button>
      </div>
      <div class="grid-3 mb-3">
        <div><label class="label">Subtotal ($)</label><input name="subtotal" type="number" class="input" id="po-subtotal" readonly></div>
        <div><label class="label">Shipping ($)</label><input name="shipping_amount" type="number" class="input" value="0" oninput="updatePOTotal()"></div>
        <div><label class="label">Total ($)</label><input name="total" type="number" class="input" id="po-total" readonly></div>
      </div>
      <div class="grid-2 mb-3">
        <div><label class="label">Expected Delivery</label><input name="expected_delivery" type="date" class="input"></div>
        <div><label class="label">Status</label>
          <select name="status" class="select">
            <option value="draft">Draft</option>
            <option value="quote_requested">Quote Requested</option>
            <option value="approved">Approved</option>
            <option value="submitted">Submitted</option>
          </select>
        </div>
      </div>
      <div class="mb-3"><label class="label">Notes</label><textarea name="notes" class="input" rows="2"></textarea></div>
      <input type="hidden" name="id">
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-po')">Cancel</button>
        <button type="submit" class="btn btn-primary">Create PO</button>
      </div>
    </form>
  </div>
</div>

<!-- Tracking Modal -->
<div class="modal" id="modal-tracking">
  <div class="modal-box" style="max-width:450px">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold">Add Tracking Info</h3>
      <button onclick="closeModal('modal-tracking')" class="text-slate-400">&times;</button>
    </div>
    <form id="tracking-form" onsubmit="saveTracking(event)">
      <div class="mb-3">
        <label class="label">Carrier</label>
        <select name="carrier" class="select">
          <option value="UPS">UPS</option>
          <option value="FedEx">FedEx</option>
          <option value="USPS">USPS</option>
          <option value="Estes Express">Estes Express</option>
          <option value="XPO Logistics">XPO Logistics</option>
          <option value="ABF Freight">ABF Freight</option>
          <option value="Old Dominion">Old Dominion</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="label">Tracking Number</label>
        <input name="tracking_number" class="input" required placeholder="Enter tracking number">
      </div>
      <input type="hidden" name="po_id">
      <div class="flex gap-3 justify-end">
        <button type="button" class="btn btn-secondary" onclick="closeModal('modal-tracking')">Cancel</button>
        <button type="submit" class="btn btn-success"><i class="fas fa-truck"></i> Add Tracking & Notify Customer</button>
      </div>
    </form>
  </div>
</div>

<script src="/static/app.js"></script>
</body>
</html>`
}

export default app
