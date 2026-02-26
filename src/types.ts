// Type definitions for Amberway Equine CRM

export type Bindings = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  QB_CLIENT_ID?: string;
  QB_CLIENT_SECRET?: string;
  QB_REFRESH_TOKEN?: string;
  QB_REALM_ID?: string;
  SESSION_SECRET?: string;
};

export interface Contact {
  id: number;
  company_id?: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  role?: string;
  type?: string;
  city?: string;
  state?: string;
  tags?: string;
  source?: string;
  preferred_contact?: string;
  ai_summary?: string;
  last_contacted_at?: string;
  quickbooks_id?: string;
  created_at?: string;
  updated_at?: string;
  company_name?: string;
}

export interface Company {
  id: number;
  name: string;
  type?: string;
  website?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  quickbooks_id?: string;
  created_at?: string;
}

export interface Deal {
  id: number;
  title: string;
  contact_id?: number;
  company_id?: number;
  stage?: string;
  status?: string;
  priority?: string;
  value?: number;
  probability?: number;
  product_categories?: string;
  ai_status_summary?: string;
  ai_next_action?: string;
  expected_close_date?: string;
  quickbooks_estimate_id?: string;
  quickbooks_invoice_id?: string;
  created_at?: string;
  updated_at?: string;
  contact_name?: string;
  company_name?: string;
}

export interface Task {
  id: number;
  deal_id?: number;
  contact_id?: number;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: string;
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  ai_generated?: number;
  created_at?: string;
  deal_title?: string;
  contact_name?: string;
}

export interface Communication {
  id: number;
  deal_id?: number;
  contact_id?: number;
  type?: string;
  direction?: string;
  subject?: string;
  body?: string;
  summary?: string;
  status?: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  from_address?: string;
  to_address?: string;
  created_at?: string;
  contact_name?: string;
  deal_title?: string;
}

export interface PurchaseOrder {
  id: number;
  deal_id?: number;
  supplier_id?: number;
  po_number?: string;
  status?: string;
  line_items?: string;
  total?: number;
  supplier_order_number?: string;
  expected_delivery?: string;
  tracking_numbers?: string;
  created_at?: string;
  supplier_name?: string;
  deal_title?: string;
}

export type StageKey = 
  | 'lead' | 'qualified' | 'proposal_sent' | 'estimate_sent' 
  | 'estimate_accepted' | 'invoice_sent' | 'invoice_paid' 
  | 'order_placed' | 'order_confirmed' | 'shipping' | 'delivered' | 'completed'
  | 'lost' | 'on_hold';

export const STAGE_LABELS: Record<StageKey, string> = {
  lead: 'New Lead',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  estimate_sent: 'Estimate Sent',
  estimate_accepted: 'Estimate Accepted',
  invoice_sent: 'Invoice Sent',
  invoice_paid: 'Invoice Paid',
  order_placed: 'Order Placed',
  order_confirmed: 'Order Confirmed',
  shipping: 'Shipping',
  delivered: 'Delivered',
  completed: 'Completed',
  lost: 'Lost',
  on_hold: 'On Hold'
};

export const STAGE_COLORS: Record<StageKey, string> = {
  lead: '#6B7280',
  qualified: '#3B82F6',
  proposal_sent: '#8B5CF6',
  estimate_sent: '#F59E0B',
  estimate_accepted: '#10B981',
  invoice_sent: '#06B6D4',
  invoice_paid: '#22C55E',
  order_placed: '#84CC16',
  order_confirmed: '#14B8A6',
  shipping: '#6366F1',
  delivered: '#059669',
  completed: '#16A34A',
  lost: '#EF4444',
  on_hold: '#9CA3AF'
};
