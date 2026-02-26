// Database helper utilities
import type { Bindings } from '../types'
import type { Context } from 'hono'

export async function logActivity(
  db: D1Database,
  params: {
    deal_id?: number
    contact_id?: number
    entity_type: string
    entity_id: number
    action: string
    description: string
    old_value?: string
    new_value?: string
    performed_by?: string
  }
) {
  await db.prepare(`
    INSERT INTO activity_log (deal_id, contact_id, entity_type, entity_id, action, description, old_value, new_value, performed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    params.deal_id || null,
    params.contact_id || null,
    params.entity_type,
    params.entity_id,
    params.action,
    params.description,
    params.old_value || null,
    params.new_value || null,
    params.performed_by || 'system'
  ).run()
}

export async function createNotification(
  db: D1Database,
  params: {
    type: string
    title: string
    message?: string
    entity_type?: string
    entity_id?: number
    priority?: string
    action_url?: string
  }
) {
  await db.prepare(`
    INSERT INTO notifications (type, title, message, entity_type, entity_id, priority, action_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    params.type,
    params.title,
    params.message || null,
    params.entity_type || null,
    params.entity_id || null,
    params.priority || 'normal',
    params.action_url || null
  ).run()
}

export function generatePONumber(): string {
  const date = new Date()
  const y = date.getFullYear().toString().slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `PO-${y}${m}${d}-${rand}`
}

export function generateEstimateNumber(): string {
  const date = new Date()
  const y = date.getFullYear().toString().slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `EST-${y}${m}-${rand}`
}

export function generateInvoiceNumber(): string {
  const date = new Date()
  const y = date.getFullYear().toString().slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `INV-${y}${m}-${rand}`
}

export function parseTags(tagsJson: string | null | undefined): string[] {
  try {
    return JSON.parse(tagsJson || '[]')
  } catch {
    return []
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
