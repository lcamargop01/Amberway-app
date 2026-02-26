-- Amberway Equine CRM - Full Database Schema
-- Migration 0001: Initial Schema

-- ============================================================
-- CONTACTS & COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'customer', -- customer, supplier, prospect
  website TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  notes TEXT,
  tags TEXT DEFAULT '[]', -- JSON array
  quickbooks_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  title TEXT,
  role TEXT DEFAULT 'decision_maker', -- decision_maker, influencer, user, other
  type TEXT DEFAULT 'customer', -- customer, supplier, prospect, lead
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'USA',
  notes TEXT,
  tags TEXT DEFAULT '[]', -- JSON array
  source TEXT, -- website, referral, trade_show, cold_call, etc.
  preferred_contact TEXT DEFAULT 'email', -- email, phone, text
  do_not_contact INTEGER DEFAULT 0,
  gmail_thread_ids TEXT DEFAULT '[]', -- JSON array of Gmail thread IDs
  quickbooks_id TEXT,
  ai_summary TEXT,
  last_contacted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);

-- ============================================================
-- PIPELINE / DEALS
-- ============================================================

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  contact_id INTEGER REFERENCES contacts(id),
  company_id INTEGER REFERENCES companies(id),
  stage TEXT DEFAULT 'lead', 
  -- Stages: lead, qualified, proposal_sent, estimate_sent, estimate_accepted, 
  --         invoice_sent, invoice_paid, order_placed, order_confirmed, 
  --         shipping, delivered, completed, lost, on_hold
  status TEXT DEFAULT 'active', -- active, won, lost, on_hold
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  value REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  probability INTEGER DEFAULT 50,
  source TEXT,
  product_categories TEXT DEFAULT '[]', -- JSON array: stalls, fencing, lighting, etc.
  products TEXT DEFAULT '[]', -- JSON array of product items
  notes TEXT,
  ai_status_summary TEXT,
  ai_next_action TEXT,
  ai_last_analyzed DATETIME,
  expected_close_date DATE,
  actual_close_date DATE,
  lost_reason TEXT,
  quickbooks_estimate_id TEXT,
  quickbooks_invoice_id TEXT,
  quickbooks_estimate_url TEXT,
  quickbooks_invoice_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

-- ============================================================
-- COMMUNICATIONS LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  company_id INTEGER REFERENCES companies(id),
  type TEXT NOT NULL, -- email, sms, call, note, meeting, task
  direction TEXT DEFAULT 'outbound', -- inbound, outbound, internal
  subject TEXT,
  body TEXT,
  summary TEXT, -- AI-generated summary
  status TEXT DEFAULT 'sent', -- draft, sent, delivered, read, failed, missed, completed
  duration_seconds INTEGER, -- for calls
  recording_url TEXT, -- for calls
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  twilio_sid TEXT,
  from_address TEXT,
  to_address TEXT,
  attachments TEXT DEFAULT '[]', -- JSON array
  metadata TEXT DEFAULT '{}', -- JSON object for extra data
  scheduled_at DATETIME,
  sent_at DATETIME,
  read_at DATETIME,
  created_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_deal ON communications(deal_id);
CREATE INDEX IF NOT EXISTS idx_comm_contact ON communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_comm_type ON communications(type);
CREATE INDEX IF NOT EXISTS idx_comm_gmail ON communications(gmail_message_id);

-- ============================================================
-- TASKS & REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'follow_up', -- follow_up, call, email, meeting, quote_request, order_check, delivery_check
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, cancelled, snoozed
  assigned_to TEXT DEFAULT 'team',
  due_date DATETIME,
  completed_at DATETIME,
  snoozed_until DATETIME,
  ai_generated INTEGER DEFAULT 0,
  reminder_sent INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_deal ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

-- ============================================================
-- ESTIMATES & QUOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  estimate_number TEXT UNIQUE,
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, accepted, rejected, expired
  line_items TEXT DEFAULT '[]', -- JSON array
  subtotal REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  valid_until DATE,
  quickbooks_id TEXT,
  quickbooks_url TEXT,
  sent_at DATETIME,
  viewed_at DATETIME,
  accepted_at DATETIME,
  rejected_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER REFERENCES deals(id),
  estimate_id INTEGER REFERENCES estimates(id),
  contact_id INTEGER REFERENCES contacts(id),
  invoice_number TEXT UNIQUE,
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, partial, paid, overdue, void
  line_items TEXT DEFAULT '[]',
  subtotal REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  amount_paid REAL DEFAULT 0,
  amount_due REAL DEFAULT 0,
  due_date DATE,
  notes TEXT,
  terms TEXT,
  quickbooks_id TEXT,
  quickbooks_url TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  sent_at DATETIME,
  viewed_at DATETIME,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SUPPLIERS & PURCHASE ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  product_categories TEXT DEFAULT '[]', -- JSON array
  lead_time_days INTEGER DEFAULT 14,
  notes TEXT,
  auto_quote_enabled INTEGER DEFAULT 0,
  quote_email_template TEXT,
  portal_url TEXT,
  portal_credentials TEXT, -- encrypted JSON
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER REFERENCES deals(id),
  invoice_id INTEGER REFERENCES invoices(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  po_number TEXT UNIQUE,
  status TEXT DEFAULT 'draft',
  -- Statuses: draft, quote_requested, quote_received, approved, submitted, 
  --           confirmed, in_production, shipped, partially_received, received, cancelled
  line_items TEXT DEFAULT '[]', -- JSON array
  subtotal REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  shipping_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  quote_reference TEXT,
  supplier_order_number TEXT,
  expected_delivery DATE,
  actual_delivery DATE,
  shipping_carrier TEXT,
  tracking_numbers TEXT DEFAULT '[]', -- JSON array
  notes TEXT,
  supplier_notes TEXT,
  attachments TEXT DEFAULT '[]',
  quote_requested_at DATETIME,
  quote_received_at DATETIME,
  approved_at DATETIME,
  submitted_at DATETIME,
  confirmed_at DATETIME,
  shipped_at DATETIME,
  received_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_deal ON purchase_orders(deal_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- ============================================================
-- SHIPMENT TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT DEFAULT 'pending',
  -- Statuses: pending, label_created, picked_up, in_transit, out_for_delivery, 
  --           delivered, exception, returned
  estimated_delivery DATE,
  actual_delivery DATETIME,
  current_location TEXT,
  tracking_history TEXT DEFAULT '[]', -- JSON array of events
  customer_notified INTEGER DEFAULT 0,
  last_checked_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_deal ON shipments(deal_id);

-- ============================================================
-- PRODUCTS CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category TEXT,
  -- Categories: stalls_gates, fencing, lighting, flooring, fans_ventilation, 
  --             arenas, horse_walkers, treadmills, therapeutic, fly_systems, other
  description TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  cost_price REAL DEFAULT 0,
  sell_price REAL DEFAULT 0,
  unit TEXT DEFAULT 'each',
  lead_time_days INTEGER DEFAULT 14,
  quickbooks_item_id TEXT,
  active INTEGER DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AI ANALYSIS LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_analysis_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT, -- deal, contact, communication
  entity_id INTEGER,
  analysis_type TEXT, -- status_update, sentiment, next_action, summary
  input_data TEXT,
  output_data TEXT,
  model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SETTINGS & INTEGRATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  type TEXT DEFAULT 'text', -- text, json, boolean, number, secret
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- task_due, deal_update, payment_received, shipment_update, ai_alert
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  read INTEGER DEFAULT 0,
  action_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT, -- estimate, invoice, follow_up, shipping_update, welcome, quote_request
  subject TEXT,
  body TEXT,
  variables TEXT DEFAULT '[]', -- JSON array of variable names
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ACTIVITY FEED
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER REFERENCES deals(id),
  contact_id INTEGER REFERENCES contacts(id),
  entity_type TEXT,
  entity_id INTEGER,
  action TEXT NOT NULL,
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_deal ON activity_log(deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_contact ON activity_log(contact_id);
