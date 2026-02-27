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
import shipmentsRoutes from './routes/shipments'
import apiRoutes from './routes/api'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

app.use('/static/*', serveStatic({ root: './' }))

app.use('/api/*', async (c, next) => {
  const { DB } = c.env
  if (!DB) return c.json({ error: 'Database not initialized.' }, 503)
  await next()
})

app.route('/api/contacts', contactsRoutes)
app.route('/api/deals', dealsRoutes)
app.route('/api/communications', communicationsRoutes)
app.route('/api/tasks', tasksRoutes)
app.route('/api/purchase-orders', purchaseOrdersRoutes)
app.route('/api/shipments', shipmentsRoutes)
app.route('/api', apiRoutes)

app.get('*', (c) => c.html(HTML))

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Amberway CRM</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
<style>
/* ── RESET & BASE ─────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html { height: 100%; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
  background: #F2F2F7;
  color: #1C1C1E;
  height: 100%;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* ── LAYOUT ───────────────────────────────────── */
.app-wrap { max-width: 430px; margin: 0 auto; position: relative; min-height: 100dvh; background: #F2F2F7; }

/* ── PAGES ────────────────────────────────────── */
.page { display: none; flex-direction: column; min-height: 100dvh; padding-bottom: 84px; }
.page.active { display: flex; }

/* ── NAV BAR ──────────────────────────────────── */
.nav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 0.5px solid rgba(0,0,0,0.12);
  display: flex; z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.nav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 10px 4px 8px; border: none; background: none; cursor: pointer;
  color: #8E8E93; font-size: 10px; font-weight: 500; gap: 3px;
  letter-spacing: 0.01em; transition: color 0.15s;
}
.nav-item i { font-size: 21px; line-height: 1; }
.nav-item.active { color: #007AFF; }
.nav-item.active i { color: #007AFF; }
.nav-badge {
  position: absolute; top: 7px; right: calc(50% - 18px);
  min-width: 16px; height: 16px; background: #FF3B30;
  border-radius: 8px; border: 2px solid rgba(255,255,255,0.9);
  font-size: 9px; font-weight: 700; color: #fff;
  display: none; align-items: center; justify-content: center; padding: 0 3px;
}
.nav-badge.show { display: flex; }

/* ── PAGE HEADER ──────────────────────────────── */
.page-header {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0,0,0,0.1);
  padding: 16px 16px 14px;
  position: sticky; top: 0; z-index: 50;
}
.page-title { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: #1C1C1E; }
.page-subtitle { font-size: 13px; color: #8E8E93; margin-top: 1px; }

/* ── SECTION HEADER ───────────────────────────── */
.section-head {
  font-size: 11px; font-weight: 600; color: #8E8E93;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 20px 16px 8px;
}

/* ── KPI STRIP ────────────────────────────────── */
.kpi-strip {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 10px; padding: 14px 16px;
}
.kpi-card {
  background: #fff; border-radius: 14px;
  padding: 14px 12px; text-align: center;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05);
}
.kpi-value { font-size: 26px; font-weight: 700; line-height: 1; letter-spacing: -0.5px; }
.kpi-label { font-size: 11px; color: #8E8E93; margin-top: 4px; font-weight: 500; }

/* ── INSET LIST (grouped cards) ───────────────── */
.inset-list {
  background: #fff; border-radius: 14px;
  margin: 0 16px; overflow: hidden;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05);
}
.inset-list .list-row {
  display: flex; align-items: center; gap: 14px;
  padding: 13px 16px;
  border-bottom: 0.5px solid #E5E5EA;
  cursor: pointer; transition: background 0.1s;
  text-decoration: none; color: inherit;
}
.inset-list .list-row:last-child { border-bottom: none; }
.inset-list .list-row:active { background: #F2F2F7; }

/* ── ICON CIRCLE ──────────────────────────────── */
.icon-circle {
  width: 42px; height: 42px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}

/* ── ROW TEXT ─────────────────────────────────── */
.row-main { font-size: 15px; font-weight: 600; color: #1C1C1E; line-height: 1.3; }
.row-sub  { font-size: 13px; color: #8E8E93; margin-top: 2px; }
.row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.row-value { font-size: 15px; font-weight: 600; color: #34C759; }
.row-chevron { color: #C7C7CC; font-size: 12px; }

/* ── DEAL CARD ────────────────────────────────── */
.deal-card {
  background: #fff; border-radius: 16px;
  margin: 0 16px 10px; padding: 16px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer; border-left: 4px solid #E5E5EA;
  transition: transform 0.1s;
  -webkit-user-select: none; user-select: none;
}
.deal-card:active { transform: scale(0.985); }
.deal-title { font-size: 16px; font-weight: 700; color: #1C1C1E; line-height: 1.3; }
.deal-contact { font-size: 13px; color: #8E8E93; margin-top: 4px; }
.deal-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; flex-wrap: wrap; gap: 6px; }
.deal-value { font-size: 17px; font-weight: 700; color: #34C759; }

/* ── STAGE BADGE ──────────────────────────────── */
.stage-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 8px;
  font-size: 12px; font-weight: 600;
}

/* ── NEXT ACTION ──────────────────────────────── */
.next-action {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600;
}

/* ── ACTION NEEDED CARD ───────────────────────── */
.action-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px; cursor: pointer; transition: background 0.1s;
  border-bottom: 0.5px solid #E5E5EA;
}
.action-card:last-child { border-bottom: none; }
.action-card:active { background: #F9F9F9; }

/* ── TASK ROW ─────────────────────────────────── */
.task-row {
  display: flex; align-items: center; gap: 14px;
  padding: 13px 16px; cursor: pointer; transition: background 0.1s;
  border-bottom: 0.5px solid #E5E5EA;
}
.task-row:last-child { border-bottom: none; }
.task-row:active { background: #F2F2F7; }
.task-check {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid #C7C7CC; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.15s;
}
.task-check.done { background: #34C759; border-color: #34C759; }

/* ── CONTACT ROW ──────────────────────────────── */
.contact-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 16px; cursor: pointer; transition: background 0.1s;
  border-bottom: 0.5px solid #E5E5EA;
}
.contact-row:last-child { border-bottom: none; }
.contact-row:active { background: #F2F2F7; }
.avatar {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 16px; flex-shrink: 0;
}

/* ── OUTREACH ROW (Today + Pipeline) ──────────── */
.outreach-row {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 14px; cursor: pointer; transition: background 0.1s;
  border-bottom: 0.5px solid #E5E5EA;
}
.outreach-row:last-child { border-bottom: none; }
.outreach-row:active { background: #F5F5F7; }

/* ── PO CARD ──────────────────────────────────── */
.po-card {
  background: #fff; border-radius: 16px;
  margin: 0 16px 10px; padding: 16px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer; border-left: 4px solid #E5E5EA;
  transition: transform 0.1s;
}
.po-card:active { transform: scale(0.985); }

/* ── BOTTOM SHEET ─────────────────────────────── */
.sheet-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 200; display: none;
}
.sheet-backdrop.open { display: block; }
.sheet {
  position: fixed; bottom: 0; left: 50%; 
  transform: translateX(-50%) translateY(100%);
  width: 100%; max-width: 430px;
  background: #fff; border-radius: 20px 20px 0 0;
  z-index: 201; max-height: 92dvh; overflow-y: auto;
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
}
.sheet.open { transform: translateX(-50%) translateY(0); }
.sheet-pill {
  width: 36px; height: 4px; background: #D1D1D6;
  border-radius: 2px; margin: 12px auto 0; display: block;
}
.sheet-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 0;
}
.sheet-title { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
.sheet-close {
  width: 30px; height: 30px; border-radius: 50%;
  background: #E5E5EA; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; color: #636366; flex-shrink: 0;
}
.sheet-body { padding: 16px 20px 8px; }

/* ── FORM FIELDS ──────────────────────────────── */
.form-group { margin-bottom: 14px; }
.form-label {
  display: block; font-size: 12px; font-weight: 600;
  color: #8E8E93; letter-spacing: 0.04em; text-transform: uppercase;
  margin-bottom: 6px;
}
.form-input {
  width: 100%; padding: 13px 14px;
  border: 1.5px solid #E5E5EA; border-radius: 12px;
  font-size: 16px; color: #1C1C1E; background: #F9F9F9;
  outline: none; -webkit-appearance: none;
  font-family: inherit; transition: border-color 0.15s, background 0.15s;
}
.form-input:focus { border-color: #007AFF; background: #fff; }
.form-input::placeholder { color: #C7C7CC; }

/* ── BUTTONS ──────────────────────────────────── */
.btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 15px 20px; border-radius: 14px;
  font-size: 16px; font-weight: 600; border: none; cursor: pointer;
  font-family: inherit; letter-spacing: -0.1px; transition: opacity 0.1s, transform 0.1s;
}
.btn:active { transform: scale(0.97); opacity: 0.85; }
.btn-primary  { background: #007AFF; color: #fff; }
.btn-green    { background: #34C759; color: #fff; }
.btn-orange   { background: #FF9500; color: #fff; }
.btn-red-soft { background: #FFF2F0; color: #FF3B30; border: 1px solid #FFCCC7; }
.btn-gray     { background: #F2F2F7; color: #1C1C1E; }
.btn-purple   { background: #5856D6; color: #fff; }
.btn-teal     { background: #5AC8FA; color: #fff; }

/* ── CONTACT ACTION BTNS ──────────────────────── */
.contact-actions { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
.contact-btn {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 14px 8px; border-radius: 14px; text-decoration: none;
  border: none; cursor: pointer; font-family: inherit; transition: opacity 0.1s, transform 0.1s;
}
.contact-btn:active { transform: scale(0.94); opacity: 0.75; }
.contact-btn i { font-size: 22px; }
.contact-btn span { font-size: 12px; font-weight: 600; }

/* ── STAGE PILL ───────────────────────────────── */
.stage-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 0 0 4px; }
.stage-scroll::-webkit-scrollbar { display: none; }
.stage-pills { display: flex; gap: 7px; width: max-content; }
.s-pill {
  padding: 7px 14px; border-radius: 100px;
  border: 1.5px solid #E5E5EA; background: #fff;
  font-size: 13px; font-weight: 600; white-space: nowrap;
  cursor: pointer; color: #636366; transition: all 0.15s;
}
.s-pill.active { border-width: 1.5px; }

/* ── SEGMENT ──────────────────────────────────── */
.segment { display: flex; background: #E5E5EA; border-radius: 10px; padding: 2px; gap: 2px; }
.seg-btn {
  flex: 1; padding: 7px 10px; border-radius: 8px;
  border: none; background: none; font-size: 14px;
  font-weight: 500; color: #636366; cursor: pointer;
  font-family: inherit; transition: all 0.15s;
}
.seg-btn.active { background: #fff; color: #1C1C1E; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }

/* ── TASK FILTER CHIPS ───────────────────────── */
.task-chip {
  flex-shrink: 0; padding: 5px 12px; border-radius: 20px;
  border: 1.5px solid #E5E5EA; background: #fff;
  font-size: 12px; font-weight: 600; color: #636366;
  cursor: pointer; font-family: inherit; white-space: nowrap;
  transition: all 0.15s;
}
.task-chip.active {
  background: #1C1C1E; color: #fff; border-color: #1C1C1E;
}

/* ── COMM TABS ────────────────────────────────── */
.comm-tabs { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
.comm-tab {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 4px; border-radius: 12px;
  border: 1.5px solid #E5E5EA; background: #F9F9F9;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.comm-tab i { font-size: 18px; color: #8E8E93; }
.comm-tab span { font-size: 11px; font-weight: 600; color: #8E8E93; }
.comm-tab.active { background: #EEF4FF; border-color: #007AFF; }
.comm-tab.active i, .comm-tab.active span { color: #007AFF; }

/* ── EMPTY STATE ──────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 24px; gap: 12px; text-align: center;
}
.empty-state i { font-size: 48px; color: #D1D1D6; }
.empty-state p { font-size: 15px; color: #8E8E93; line-height: 1.5; }

/* ── ALL GOOD BANNER ──────────────────────────── */
.all-good {
  display: flex; align-items: center; gap: 14px;
  background: #F0FDF4; border-radius: 14px;
  padding: 16px; margin: 0 16px;
  border: 1px solid #BBF7D0;
}

/* ── SPINNER ──────────────────────────────────── */
.loading { display: flex; justify-content: center; padding: 40px; color: #C7C7CC; font-size: 24px; }

/* ── URGENT BANNER ────────────────────────────── */
.urgent-badge {
  background: #FFF1F0; color: #FF3B30;
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 6px;
  letter-spacing: 0.05em;
}

/* ── NEXT STEP BANNER ─────────────────────────── */
.next-banner {
  border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;
}

/* ── INFO ROWS ────────────────────────────────── */
.info-block { background: #F9F9F9; border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
.info-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 0.5px solid #E5E5EA;
}
.info-row:last-child { border-bottom: none; }
.info-row i { width: 20px; text-align: center; color: #8E8E93; font-size: 14px; flex-shrink: 0; }
.info-row span { font-size: 14px; color: #3C3C43; }

/* ── MINI TASK LIST ───────────────────────────── */
.mini-task {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-bottom: 0.5px solid #E5E5EA;
}
.mini-task:last-child { border-bottom: none; }
.mini-check {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid #C7C7CC; flex-shrink: 0;
  cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
}

/* ── TOAST ────────────────────────────────────── */
#toast-container {
  position: fixed; top: max(env(safe-area-inset-top,0px),60px);
  left: 50%; transform: translateX(-50%);
  width: calc(100% - 32px); max-width: 398px;
  z-index: 999; pointer-events: none;
  display: flex; flex-direction: column; gap: 8px;
}
.toast-msg {
  padding: 14px 18px; border-radius: 14px;
  font-size: 14px; font-weight: 600; color: #fff;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  animation: toastIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes toastIn {
  from { transform: translateY(-16px) scale(0.95); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}

/* ── QUICK ADD GRID ───────────────────────────── */
.add-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.add-tile {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 18px 16px; border-radius: 16px; border: none;
  cursor: pointer; font-family: inherit; transition: transform 0.1s, opacity 0.1s;
  text-align: left;
}
.add-tile:active { transform: scale(0.96); opacity: 0.85; }
.add-tile i { font-size: 24px; }
.add-tile-label { font-size: 15px; font-weight: 600; }
.add-tile-sub { font-size: 12px; opacity: 0.7; }

/* ── DIVIDER ──────────────────────────────────── */
.spacer { height: 8px; background: #F2F2F7; }

/* ── SEARCH ───────────────────────────────────── */
.search-wrap {
  position: relative; margin-top: 10px;
}
.search-wrap i {
  position: absolute; left: 12px; top: 50%;
  transform: translateY(-50%); color: #8E8E93; font-size: 14px;
}
.search-input {
  width: 100%; padding: 11px 12px 11px 36px;
  background: rgba(118,118,128,0.12); border: none; border-radius: 12px;
  font-size: 15px; color: #1C1C1E; outline: none;
  font-family: inherit;
}
.search-input::placeholder { color: #8E8E93; }

/* ── PRIORITY DOT ─────────────────────────────── */
.p-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── AI COMPOSER ──────────────────────────────── */
.ai-intent-btn {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 12px 14px; border-radius: 12px; border: 1.5px solid #E5E5EA;
  background: #F9F9F9; cursor: pointer; font-family: inherit;
  text-align: left; width: 100%; transition: all 0.15s;
}
.ai-intent-btn:active { transform: scale(0.97); opacity: 0.85; }
.ai-intent-btn.selected { border-color: #5856D6; background: #F5F3FF; }
.ai-intent-btn i { font-size: 18px; }
.ai-intent-btn .label { font-size: 14px; font-weight: 600; }
.ai-intent-btn .sub   { font-size: 12px; color: #8E8E93; }

.ai-draft-area {
  position: relative; margin-bottom: 14px;
}
.ai-draft-area textarea {
  width: 100%; padding: 13px 14px 44px;
  border: 1.5px solid #5856D6; border-radius: 12px;
  font-size: 14px; color: #1C1C1E; background: #F5F3FF;
  outline: none; font-family: inherit; resize: vertical; min-height: 140px;
  line-height: 1.6;
}
.ai-draft-footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(transparent, #F5F3FF 60%);
  border-radius: 0 0 12px 12px;
  pointer-events: none;
}
.ai-badge {
  display: inline-flex; align-items: center; gap: 5px;
  background: #5856D6; color: #fff;
  font-size: 11px; font-weight: 700; padding: 3px 9px;
  border-radius: 100px; letter-spacing: 0.03em;
  pointer-events: auto;
}

/* ── EMAIL THREAD VIEWER ──────────────────────── */
.thread-bubble {
  padding: 12px 16px; border-radius: 14px; margin-bottom: 10px;
  font-size: 14px; line-height: 1.6; color: #1C1C1E;
}
.thread-bubble.outbound { background: #EEF4FF; margin-left: 12px; }
.thread-bubble.inbound  { background: #F2F2F7; margin-right: 12px; }
.thread-meta {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px; font-size: 12px;
}
.thread-from { font-weight: 700; color: #3C3C43; }
.thread-time { color: #8E8E93; }
.thread-subj { font-size: 11px; color: #8E8E93; margin-bottom: 4px; }

/* ── SHIPMENT TRACKING ────────────────────────── */
.track-status-ring {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.track-timeline { position: relative; padding-left: 20px; }
.track-timeline::before {
  content: ''; position: absolute; left: 6px; top: 8px;
  bottom: 8px; width: 2px; background: #E5E5EA;
}
.track-event {
  position: relative; display: flex; flex-direction: column;
  padding: 0 0 16px 16px;
}
.track-event::before {
  content: ''; position: absolute; left: -1px; top: 5px;
  width: 10px; height: 10px; border-radius: 50%;
  background: #E5E5EA; border: 2px solid #fff;
  box-shadow: 0 0 0 2px #E5E5EA;
}
.track-event.active::before {
  background: #007AFF; box-shadow: 0 0 0 2px #007AFF;
}
.track-event.delivered::before {
  background: #34C759; box-shadow: 0 0 0 2px #34C759;
}
.track-event-time { font-size: 11px; color: #8E8E93; font-weight: 500; }
.track-event-desc { font-size: 14px; font-weight: 600; color: #1C1C1E; margin-top: 2px; }
.track-event-loc  { font-size: 12px; color: #8E8E93; margin-top: 1px; }

.shipment-card {
  background: #fff; border-radius: 16px;
  margin: 0 16px 10px; padding: 16px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04);
  cursor: pointer; border-left: 4px solid #5856D6;
  transition: transform 0.1s;
}
.shipment-card:active { transform: scale(0.985); }
.shipment-card.delivered { border-left-color: #34C759; }
.shipment-card.out_for_delivery { border-left-color: #FF9500; }</style>
</head>
<body>
<div class="app-wrap">

<!-- ─────────────────────────────────────────────
     TOAST CONTAINER
───────────────────────────────────────────── -->
<div id="toast-container"></div>

<!-- ═════════════════════════════════════════════
     PAGE: TODAY
═════════════════════════════════════════════ -->
<div class="page active" id="page-home">
  <div class="page-header" style="padding-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div id="hdr-date" style="font-size:12px;color:#8E8E93;font-weight:500;text-transform:uppercase;letter-spacing:.04em"></div>
        <div id="hdr-greet" class="page-title" style="font-size:24px">Today</div>
      </div>
      <button onclick="openSheet('sh-quickadd')" style="width:36px;height:36px;background:#007AFF;border-radius:50%;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <!-- Role toggle -->
    <div style="display:flex;gap:8px;margin-top:12px">
      <button id="view-brian" onclick="setHomeView('brian',this)" style="flex:1;padding:8px;border-radius:10px;border:none;font-size:13px;font-weight:700;cursor:pointer;background:#1C1C1E;color:#fff">👋 Brian — Outreach</button>
      <button id="view-laura" onclick="setHomeView('laura',this)" style="flex:1;padding:8px;border-radius:10px;border:2px solid #E5E5EA;font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:#3C3C43">⚙️ Laura — Operations</button>
    </div>
  </div>

  <!-- Stage summary pills -->
  <div id="stage-pills" style="display:flex;gap:8px;padding:0 16px 12px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none"></div>

  <!-- Brian view: outreach groups -->
  <div id="brian-view">
    <div id="home-outreach">
      <div class="loading"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
  </div>

  <!-- Laura view: operations tasks -->
  <div id="laura-view" style="display:none">
    <div id="home-ops">
      <div class="loading"><i class="fas fa-spinner fa-spin"></i></div>
    </div>
  </div>

  <div style="height:24px"></div>
</div>

<!-- ═════════════════════════════════════════════
     PAGE: PIPELINE
═════════════════════════════════════════════ -->
<div class="page" id="page-deals">
  <div class="page-header" style="padding-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="page-title">Pipeline</div>
      <button onclick="openSheet('sh-quickadd')" style="padding:8px 14px;background:#007AFF;color:#fff;border-radius:10px;border:none;font-size:13px;font-weight:600;cursor:pointer">+ Deal</button>
    </div>
    <!-- Stage filter scrollable row -->
    <div id="pipe-stage-tabs" style="display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px"></div>
  </div>
  <div id="deals-list">
    <div class="loading"><i class="fas fa-spinner fa-spin"></i></div>
  </div>
  <div style="height:20px"></div>
</div>

<!-- ═════════════════════════════════════════════
     PAGE: CONTACTS
═════════════════════════════════════════════ -->
<div class="page" id="page-contacts">
  <div class="page-header" style="padding-bottom:12px">
    <div class="page-title" style="margin-bottom:10px">Contacts</div>
    <div class="search-wrap" style="margin-bottom:10px">
      <i class="fas fa-magnifying-glass"></i>
      <input type="search" class="search-input" placeholder="Search name, email, phone…" id="csearch" oninput="debounceSearch(this.value)">
    </div>
    <div class="segment" id="contacts-seg">
      <button class="seg-btn active" onclick="filterContacts('all',this)">All <span id="cnt-all" style="font-size:11px;opacity:.7"></span></button>
      <button class="seg-btn" onclick="filterContacts('lead',this)">Leads <span id="cnt-leads" style="font-size:11px;opacity:.7"></span></button>
      <button class="seg-btn" onclick="filterContacts('customer',this)">Customers <span id="cnt-cust" style="font-size:11px;opacity:.7"></span></button>
    </div>
  </div>
  <div id="contacts-list">
    <div class="loading"><i class="fas fa-spinner fa-spin"></i></div>
  </div>
  <div style="height:20px"></div>
</div>

<!-- ═════════════════════════════════════════════
     PAGE: ORDERS
═════════════════════════════════════════════ -->
<div class="page" id="page-orders">
  <div class="page-header">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="page-title">Orders</div>
    </div>
    <div class="segment" id="orders-seg">
      <button class="seg-btn active" onclick="filterOrders('shipments',this)">🚚 Shipments</button>
      <button class="seg-btn" onclick="filterOrders('orders',this)">📦 POs</button>
    </div>
  </div>
  <div id="orders-list">
    <div class="loading"><i class="fas fa-spinner fa-spin"></i></div>
  </div>
  <div style="height:20px"></div>
</div>

<!-- ═════════════════════════════════════════════
     PAGE: TASKS
═════════════════════════════════════════════ -->
<div class="page" id="page-tasks">
  <div class="page-header">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div class="page-title">Tasks</div>
      <button onclick="openAddTask()" style="padding:8px 14px;background:#007AFF;color:#fff;border-radius:10px;border:none;font-size:14px;font-weight:600;cursor:pointer">+ Add</button>
    </div>

    <!-- Search bar -->
    <div style="position:relative;margin-bottom:10px">
      <i class="fas fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#8E8E93;font-size:14px;pointer-events:none"></i>
      <input id="task-search-inp"
        type="search" placeholder="Search tasks, deals, contacts…"
        oninput="onTaskSearch(this.value)"
        style="width:100%;padding:10px 12px 10px 36px;border:1px solid #E5E5EA;border-radius:12px;font-size:15px;background:#F2F2F7;outline:none;box-sizing:border-box;font-family:inherit;-webkit-appearance:none">
    </div>

    <!-- Status tabs -->
    <div class="segment" id="tasks-seg" style="margin-bottom:8px">
      <button class="seg-btn active" onclick="filterTasks('pending',this)">Pending</button>
      <button class="seg-btn" onclick="filterTasks('done',this)">Completed</button>
    </div>

    <!-- Priority + due-date filter chips -->
    <div id="task-filter-chips" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      <button class="task-chip active" id="tchip-all"      onclick="setTaskPriority('',this)">All</button>
      <button class="task-chip"        id="tchip-overdue"  onclick="setTaskDue('overdue',this)">⚠️ Overdue</button>
      <button class="task-chip"        id="tchip-today"    onclick="setTaskDue('today',this)">Today</button>
      <button class="task-chip"        id="tchip-week"     onclick="setTaskDue('week',this)">This Week</button>
      <button class="task-chip"        id="tchip-urgent"   onclick="setTaskPriority('urgent',this)">🔴 Urgent</button>
      <button class="task-chip"        id="tchip-high"     onclick="setTaskPriority('high',this)">High</button>
      <button class="task-chip"        id="tchip-medium"   onclick="setTaskPriority('medium',this)">Medium</button>
    </div>

    <!-- Result count line -->
    <div id="tasks-count-line" style="font-size:12px;color:#8E8E93;margin-top:6px;min-height:16px"></div>
  </div>
  <div id="tasks-list">
    <div class="loading"><i class="fas fa-spinner fa-spin"></i></div>
  </div>
  <div style="height:20px"></div>
</div>

<!-- ─────────────────────────────────────────────
     BOTTOM NAV
───────────────────────────────────────────── -->
<nav class="nav">
  <button class="nav-item active" id="ni-home" onclick="navTo('home')">
    <i class="fas fa-house"></i><span>Today</span>
  </button>
  <button class="nav-item" id="ni-deals" onclick="navTo('deals')">
    <i class="fas fa-layer-group"></i><span>Pipeline</span>
  </button>
  <button class="nav-item" id="ni-contacts" onclick="navTo('contacts')">
    <i class="fas fa-person"></i><span>Contacts</span>
  </button>
  <button class="nav-item" id="ni-orders" onclick="navTo('orders')">
    <i class="fas fa-box"></i><span>Orders</span>
  </button>
  <button class="nav-item" id="ni-tasks" onclick="navTo('tasks')" style="position:relative">
    <i class="fas fa-circle-check"></i><span>Tasks</span>
    <span class="nav-badge" id="task-badge">0</span>
  </button>
</nav>

<!-- ═══════════════════════════════════════════════════
     SHEETS
═══════════════════════════════════════════════════ -->

<!-- Deal Detail -->
<div class="sheet-backdrop" id="bd-deal" onclick="closeSheet('sh-deal')"></div>
<div class="sheet" id="sh-deal">
  <span class="sheet-pill"></span>
  <div id="sh-deal-body"></div>
</div>

<!-- Contact Detail -->
<div class="sheet-backdrop" id="bd-contact" onclick="closeSheet('sh-contact')"></div>
<div class="sheet" id="sh-contact">
  <span class="sheet-pill"></span>
  <div id="sh-contact-body"></div>
</div>

<!-- Generic Panel (tasks, POs) -->
<div class="sheet-backdrop" id="bd-panel" onclick="closeSheet('sh-panel')"></div>
<div class="sheet" id="sh-panel">
  <span class="sheet-pill"></span>
  <div id="sh-panel-body"></div>
</div>

<!-- Quick Add -->
<div class="sheet-backdrop" id="bd-quickadd" onclick="closeSheet('sh-quickadd')"></div>
<div class="sheet" id="sh-quickadd">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div class="sheet-title">Quick Add</div>
    <button class="sheet-close" onclick="closeSheet('sh-quickadd')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:24px">
    <div class="add-grid">
      <button class="add-tile" style="background:#EEF4FF;color:#007AFF" onclick="closeSheet('sh-quickadd');openAddDeal()">
        <i class="fas fa-handshake"></i>
        <div><div class="add-tile-label" style="color:#007AFF">New Deal</div><div class="add-tile-sub" style="color:#007AFF">Add to pipeline</div></div>
      </button>
      <button class="add-tile" style="background:#F0FDF4;color:#34C759" onclick="closeSheet('sh-quickadd');openAddContact()">
        <i class="fas fa-user-plus"></i>
        <div><div class="add-tile-label" style="color:#34C759">New Contact</div><div class="add-tile-sub" style="color:#34C759">Client or lead</div></div>
      </button>
      <button class="add-tile" style="background:#FFF9EC;color:#FF9500" onclick="closeSheet('sh-quickadd');openAddTask()">
        <i class="fas fa-square-check"></i>
        <div><div class="add-tile-label" style="color:#FF9500">New Task</div><div class="add-tile-sub" style="color:#FF9500">Reminder or to-do</div></div>
      </button>
      <button class="add-tile" style="background:#F5F3FF;color:#5856D6" onclick="closeSheet('sh-quickadd');openLogComm()">
        <i class="fas fa-comment-dots"></i>
        <div><div class="add-tile-label" style="color:#5856D6">Log Comm</div><div class="add-tile-sub" style="color:#5856D6">Call, email, note</div></div>
      </button>
    </div>
  </div>
</div>

<!-- New Deal Form -->
<div class="sheet-backdrop" id="bd-new-deal" onclick="closeSheet('sh-new-deal')"></div>
<div class="sheet" id="sh-new-deal">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div class="sheet-title">New Deal</div>
    <button class="sheet-close" onclick="closeSheet('sh-new-deal')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:24px">
    <form id="form-deal" onsubmit="submitDeal(event)">
      <div class="form-group"><label class="form-label">Deal Title *</label><input class="form-input" name="title" required placeholder="e.g. Wellington Farm – 12 Stalls"></div>
      <div class="form-group"><label class="form-label">Contact</label><select class="form-input" name="contact_id" id="sel-deal-contact"><option value="">None</option></select></div>
      <div class="form-group"><label class="form-label">Value ($)</label><input class="form-input" name="value" type="number" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Stage</label>
        <select class="form-input" name="stage">
          <option value="lead">New Lead</option><option value="qualified">Qualified</option>
          <option value="proposal_sent">Proposal Sent</option><option value="estimate_sent">Estimate Sent</option>
          <option value="estimate_accepted">Estimate Accepted</option><option value="invoice_sent">Invoice Sent</option>
          <option value="invoice_paid">Invoice Paid</option><option value="order_placed">Order Placed</option>
          <option value="order_confirmed">Order Confirmed</option><option value="shipping">Shipping</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-input" name="notes" rows="2" placeholder="Any details…"></textarea></div>
      <button type="submit" class="btn btn-primary" style="margin-top:4px">Save Deal</button>
    </form>
  </div>
</div>

<!-- New Contact Form -->
<div class="sheet-backdrop" id="bd-new-contact" onclick="closeSheet('sh-new-contact')"></div>
<div class="sheet" id="sh-new-contact">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div class="sheet-title">New Contact</div>
    <button class="sheet-close" onclick="closeSheet('sh-new-contact')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:24px">
    <form id="form-contact" onsubmit="submitContact(event)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">First Name *</label><input class="form-input" name="first_name" required></div>
        <div class="form-group"><label class="form-label">Last Name *</label><input class="form-input" name="last_name" required></div>
      </div>
      <div class="form-group"><label class="form-label">Phone / Mobile</label><input class="form-input" name="mobile" type="tel" placeholder="(555) 000-0000"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" name="email" type="email"></div>
      <div class="form-group"><label class="form-label">Type</label>
        <select class="form-input" name="type"><option value="lead">Lead</option><option value="prospect">Prospect</option><option value="customer">Customer</option></select>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-input" name="notes" rows="2"></textarea></div>
      <button type="submit" class="btn btn-green" style="margin-top:4px">Save Contact</button>
    </form>
  </div>
</div>

<!-- New Task Form -->
<div class="sheet-backdrop" id="bd-new-task" onclick="closeSheet('sh-new-task')"></div>
<div class="sheet" id="sh-new-task">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div class="sheet-title" id="new-task-title">New Task</div>
    <button class="sheet-close" onclick="closeSheet('sh-new-task')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:24px">
    <form id="form-task" onsubmit="submitTask(event)">
      <div class="form-group"><label class="form-label">Task *</label><input class="form-input" name="title" required placeholder="What needs to be done?"></div>
      <div class="form-group"><label class="form-label">Type</label>
        <select class="form-input" name="type">
          <option value="follow_up">Follow Up</option><option value="call">Call</option>
          <option value="email">Email</option><option value="quote_request">Quote Request</option>
          <option value="order_check">Order Check</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" name="due_date" type="date"></div>
      <div class="form-group"><label class="form-label">Priority</label>
        <select class="form-input" name="priority">
          <option value="medium">Normal</option><option value="high">High</option>
          <option value="urgent">🔴 Urgent</option><option value="low">Low</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="form-input" name="notes" rows="2" placeholder="Optional notes…"></textarea></div>
      <div class="form-group"><label class="form-label">Related Deal</label><select class="form-input" name="deal_id" id="sel-task-deal"><option value="">None</option></select></div>
      <input type="hidden" name="_id" id="task-edit-id">
      <button type="submit" class="btn btn-orange" id="task-submit-btn" style="margin-top:4px">Save Task</button>
    </form>
  </div>
</div>

<!-- Log Communication Form -->
<div class="sheet-backdrop" id="bd-log-comm" onclick="closeSheet('sh-log-comm')"></div>
<div class="sheet" id="sh-log-comm">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div class="sheet-title">Log Communication</div>
    <button class="sheet-close" onclick="closeSheet('sh-log-comm')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:24px">
    <div class="comm-tabs" style="margin-bottom:16px">
      <button class="comm-tab active" id="ctab-email" onclick="setCtab('email')"><i class="fas fa-envelope"></i><span>Email</span></button>
      <button class="comm-tab" id="ctab-sms" onclick="setCtab('sms')"><i class="fas fa-comment"></i><span>Text</span></button>
      <button class="comm-tab" id="ctab-call" onclick="setCtab('call')"><i class="fas fa-phone"></i><span>Call</span></button>
      <button class="comm-tab" id="ctab-note" onclick="setCtab('note')"><i class="fas fa-note-sticky"></i><span>Note</span></button>
    </div>
    <form id="form-comm" onsubmit="submitComm(event)">
      <div class="form-group"><label class="form-label">Contact</label><select class="form-input" name="contact_id" id="sel-comm-contact"><option value="">Select…</option></select></div>
      <div class="form-group"><label class="form-label">Deal (optional)</label><select class="form-input" name="deal_id" id="sel-comm-deal"><option value="">None</option></select></div>
      <div id="cf-email">
        <div class="form-group"><label class="form-label">Subject</label><input class="form-input" name="subject" id="comm-subject" placeholder="Re: Your barn project"></div>
        <!-- AI Draft button lives here -->
        <div style="margin-bottom:10px">
          <button type="button" onclick="openAIDraft()" style="display:flex;align-items:center;gap:8px;padding:11px 16px;background:linear-gradient(135deg,#5856D6,#007AFF);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;width:100%;justify-content:center;font-family:inherit">
            <i class="fas fa-wand-magic-sparkles"></i> Draft with AI
          </button>
        </div>
        <div class="form-group"><label class="form-label">Message</label><textarea class="form-input" name="body" id="comm-body" rows="5" placeholder="Type your message or use AI Draft above…"></textarea></div>
        <!-- Open in Mail App -->
        <a id="comm-mailto-link" href="#" onclick="openMailApp();return false;"
          style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;background:#F2F2F7;color:#3C3C43;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;width:100%;text-decoration:none;margin-bottom:10px">
          <i class="fas fa-arrow-up-right-from-square"></i> Open in Mail App
        </a>
      </div>
      <div id="cf-sms" style="display:none"><div class="form-group"><label class="form-label">Message</label><textarea class="form-input" name="sms_body" rows="3" placeholder="Hi, just following up…"></textarea></div></div>
      <div id="cf-call" style="display:none">
        <div class="form-group"><label class="form-label">Call Notes</label><textarea class="form-input" name="call_notes" rows="3"></textarea></div>
        <div class="form-group"><label class="form-label">Duration (minutes)</label><input class="form-input" name="duration" type="number" placeholder="5"></div>
      </div>
      <div id="cf-note" style="display:none"><div class="form-group"><label class="form-label">Note</label><textarea class="form-input" name="note_body" rows="4"></textarea></div></div>
      <input type="hidden" name="_ctype" id="ctype-val" value="email">
      <button type="submit" class="btn btn-purple" id="comm-btn" style="margin-top:4px"><i class="fas fa-paper-plane"></i> Send Email</button>
    </form>
  </div>
</div>

<!-- ══════════════════════════════════════════════
     AI EMAIL COMPOSER SHEET
══════════════════════════════════════════════ -->
<div class="sheet-backdrop" id="bd-ai-draft" onclick="closeSheet('sh-ai-draft')"></div>
<div class="sheet" id="sh-ai-draft">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div>
      <div class="sheet-title" style="display:flex;align-items:center;gap:8px">
        <span style="display:inline-flex;width:28px;height:28px;background:linear-gradient(135deg,#5856D6,#007AFF);border-radius:8px;align-items:center;justify-content:center">
          <i class="fas fa-wand-magic-sparkles" style="color:#fff;font-size:13px"></i>
        </span>
        AI Email Draft
      </div>
      <div style="font-size:13px;color:#8E8E93;margin-top:2px">Tell AI what you want to say</div>
    </div>
    <button class="sheet-close" onclick="closeSheet('sh-ai-draft')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:28px">

    <!-- Step 1: Intent selector -->
    <div id="ai-step-intent">
      <div style="font-size:12px;font-weight:700;color:#8E8E93;letter-spacing:.05em;margin-bottom:10px">WHAT DO YOU WANT TO SAY?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <button class="ai-intent-btn" onclick="selectIntent('Follow up on the estimate we sent — check if they have questions and if they are ready to move forward')">
          <i class="fas fa-clock" style="color:#FF9500"></i>
          <div class="label">Follow Up</div>
          <div class="sub">Check in on estimate</div>
        </button>
        <button class="ai-intent-btn" onclick="selectIntent('Send a professional invoice reminder — the invoice is outstanding and we need payment to proceed')">
          <i class="fas fa-credit-card" style="color:#FF3B30"></i>
          <div class="label">Invoice Reminder</div>
          <div class="sub">Payment outstanding</div>
        </button>
        <button class="ai-intent-btn" onclick="selectIntent('Introduce ourselves and let them know about our equine equipment products and services')">
          <i class="fas fa-handshake" style="color:#007AFF"></i>
          <div class="label">Introduction</div>
          <div class="sub">New lead outreach</div>
        </button>
        <button class="ai-intent-btn" onclick="selectIntent('Confirm their order has been placed with the supplier and provide an estimated delivery timeline')">
          <i class="fas fa-box" style="color:#34C759"></i>
          <div class="label">Order Confirmation</div>
          <div class="sub">Order placed</div>
        </button>
        <button class="ai-intent-btn" onclick="selectIntent('Share the shipment tracking information so the customer can monitor their delivery')">
          <i class="fas fa-truck" style="color:#5856D6"></i>
          <div class="label">Share Tracking</div>
          <div class="sub">Shipment update</div>
        </button>
        <button class="ai-intent-btn" onclick="selectIntent('Send a thank you for their business and check that everything arrived in good condition')">
          <i class="fas fa-star" style="color:#FF9500"></i>
          <div class="label">Thank You</div>
          <div class="sub">Post-delivery</div>
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">OR DESCRIBE IN YOUR OWN WORDS</label>
        <textarea class="form-input" id="ai-custom-intent" rows="2" placeholder="e.g. Ask if they want to add rubber mats to the stall order…"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">TONE</label>
        <select class="form-input" id="ai-tone">
          <option value="professional and friendly">Professional &amp; Friendly</option>
          <option value="warm and personal">Warm &amp; Personal</option>
          <option value="concise and direct">Concise &amp; Direct</option>
          <option value="formal">Formal</option>
        </select>
      </div>

      <button onclick="runAIDraft()" class="btn" style="background:linear-gradient(135deg,#5856D6,#007AFF);color:#fff" id="ai-generate-btn">
        <i class="fas fa-wand-magic-sparkles"></i> Generate Draft
      </button>
    </div>

    <!-- Step 2: Review & edit draft -->
    <div id="ai-step-draft" style="display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:12px;font-weight:700;color:#8E8E93;letter-spacing:.05em">REVIEW &amp; EDIT</div>
        <button onclick="showAIStep('intent')" style="font-size:13px;color:#007AFF;background:none;border:none;cursor:pointer;font-weight:600">← Regenerate</button>
      </div>

      <div class="form-group">
        <label class="form-label">SUBJECT</label>
        <input class="form-input" id="ai-draft-subject" placeholder="Subject line…">
      </div>

      <div class="form-group">
        <label class="form-label">MESSAGE BODY</label>
        <div class="ai-draft-area">
          <textarea id="ai-draft-body" rows="8"></textarea>
          <div class="ai-draft-footer">
            <span class="ai-badge"><i class="fas fa-wand-magic-sparkles"></i> AI Generated</span>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;flex-direction:column;gap:10px">
        <button onclick="useAIDraft('send')" class="btn btn-primary">
          <i class="fas fa-paper-plane"></i> Send Email
        </button>
        <button onclick="useAIDraft('mailapp')" class="btn btn-gray" style="color:#5856D6">
          <i class="fas fa-arrow-up-right-from-square"></i> Open in Mail App
        </button>
        <button onclick="useAIDraft('copy')" class="btn btn-gray">
          <i class="fas fa-copy"></i> Copy to Clipboard
        </button>
      </div>
    </div>

  </div>
</div>

<!-- ══════════════════════════════════════════════
     EMAIL THREAD VIEWER SHEET
══════════════════════════════════════════════ -->
<div class="sheet-backdrop" id="bd-email-thread" onclick="closeSheet('sh-email-thread')"></div>
<div class="sheet" id="sh-email-thread">
  <span class="sheet-pill"></span>
  <div class="sheet-header" id="thread-header">
    <div style="flex:1;padding-right:8px">
      <div class="sheet-title" id="thread-title">Email Thread</div>
      <div style="font-size:13px;color:#8E8E93;margin-top:2px" id="thread-subtitle"></div>
    </div>
    <button class="sheet-close" onclick="closeSheet('sh-email-thread')"><i class="fas fa-xmark"></i></button>
  </div>
  <div id="sh-email-thread-body" class="sheet-body" style="padding-bottom:28px"></div>
</div>

<!-- ══════════════════════════════════════════════
     ADD TRACKING SHEET
══════════════════════════════════════════════ -->
<div class="sheet-backdrop" id="bd-tracking-entry" onclick="closeSheet('sh-tracking-entry')"></div>
<div class="sheet" id="sh-tracking-entry">
  <span class="sheet-pill"></span>
  <div class="sheet-header">
    <div>
      <div class="sheet-title" style="display:flex;align-items:center;gap:8px">
        <span style="display:inline-flex;width:28px;height:28px;background:#5856D6;border-radius:8px;align-items:center;justify-content:center">
          <i class="fas fa-truck" style="color:#fff;font-size:13px"></i>
        </span>
        Add Tracking
      </div>
      <div style="font-size:13px;color:#8E8E93;margin-top:2px" id="tracking-entry-subtitle">Enter shipment tracking details</div>
    </div>
    <button class="sheet-close" onclick="closeSheet('sh-tracking-entry')"><i class="fas fa-xmark"></i></button>
  </div>
  <div class="sheet-body" style="padding-bottom:28px">

    <!-- Carrier chips -->
    <div style="font-size:12px;font-weight:700;color:#8E8E93;letter-spacing:.05em;margin-bottom:10px">SELECT CARRIER</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px" id="carrier-chips">
      <button class="carrier-chip" onclick="selectCarrier('UPS')" style="padding:10px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#F9F9F9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
        <div style="font-size:18px;margin-bottom:3px">🟤</div>UPS
      </button>
      <button class="carrier-chip" onclick="selectCarrier('FedEx')" style="padding:10px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#F9F9F9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
        <div style="font-size:18px;margin-bottom:3px">🟣</div>FedEx
      </button>
      <button class="carrier-chip" onclick="selectCarrier('USPS')" style="padding:10px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#F9F9F9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
        <div style="font-size:18px;margin-bottom:3px">🦅</div>USPS
      </button>
      <button class="carrier-chip" onclick="selectCarrier('Estes Express')" style="padding:10px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#F9F9F9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
        <div style="font-size:18px;margin-bottom:3px">🚛</div>Estes
      </button>
      <button class="carrier-chip" onclick="selectCarrier('XPO Logistics')" style="padding:10px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#F9F9F9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
        <div style="font-size:18px;margin-bottom:3px">🔵</div>XPO
      </button>
      <button class="carrier-chip" onclick="selectCarrier('Other')" style="padding:10px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#F9F9F9;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">
        <div style="font-size:18px;margin-bottom:3px">📦</div>Other
      </button>
    </div>

    <form id="form-tracking" onsubmit="submitTracking(event)">
      <input type="hidden" id="tracking-po-id">
      <input type="hidden" id="tracking-deal-id">
      <input type="hidden" id="tracking-contact-id">

      <div class="form-group">
        <label class="form-label">Carrier Name</label>
        <input class="form-input" id="tracking-carrier" name="carrier" required placeholder="e.g. UPS, FedEx, Estes…">
      </div>
      <div class="form-group">
        <label class="form-label">Tracking Number *</label>
        <input class="form-input" id="tracking-number" name="tracking_number" required placeholder="1Z999AA10123456784">
      </div>
      <div class="form-group">
        <label class="form-label">Tracking URL (optional — auto-generated if blank)</label>
        <input class="form-input" id="tracking-url" name="tracking_url" type="url" placeholder="https://…">
      </div>
      <div class="form-group">
        <label class="form-label">Estimated Delivery Date</label>
        <input class="form-input" id="tracking-eta" name="estimated_delivery" type="date">
      </div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <input class="form-input" id="tracking-notes" name="notes" placeholder="Any special delivery instructions…">
      </div>

      <!-- Preview tracking URL -->
      <div id="tracking-url-preview" style="display:none;background:#EEF4FF;border-radius:12px;padding:12px 14px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#007AFF;margin-bottom:4px">TRACKING LINK PREVIEW</div>
        <div id="tracking-url-preview-text" style="font-size:13px;color:#007AFF;word-break:break-all"></div>
      </div>

      <button type="submit" class="btn" style="background:#5856D6;color:#fff;margin-bottom:10px">
        <i class="fas fa-truck"></i> Save Tracking Info
      </button>
    </form>

    <!-- After save: customer notification actions -->
    <div id="tracking-saved-actions" style="display:none;flex-direction:column;gap:10px">
      <div style="background:#F0FDF4;border-radius:14px;padding:14px;border:1px solid #BBF7D0;margin-bottom:4px">
        <div style="font-weight:700;color:#166534;font-size:15px;margin-bottom:4px">✅ Tracking Saved!</div>
        <div style="font-size:13px;color:#15803D" id="tracking-saved-msg">Order is now In Transit.</div>
      </div>
      <button onclick="notifyCustomerTracking()" class="btn btn-primary">
        <i class="fas fa-share"></i> Send Tracking to Customer
      </button>
      <button onclick="openAIDraftFromTracking()" class="btn" style="background:linear-gradient(135deg,#5856D6,#007AFF);color:#fff">
        <i class="fas fa-wand-magic-sparkles"></i> Draft Tracking Email with AI
      </button>
      <button onclick="copyTrackingLink()" class="btn btn-gray">
        <i class="fas fa-copy"></i> Copy Tracking Link
      </button>
      <button onclick="closeSheet('sh-tracking-entry')" class="btn btn-gray" style="color:#8E8E93">
        Done
      </button>
    </div>
  </div>
</div>

<!-- ══════════════════════════════════════════════
     SHIPMENT DETAIL SHEET
══════════════════════════════════════════════ -->
<div class="sheet-backdrop" id="bd-shipment-detail" onclick="closeSheet('sh-shipment-detail')"></div>
<div class="sheet" id="sh-shipment-detail">
  <span class="sheet-pill"></span>
  <div id="sh-shipment-detail-body"></div>
</div>

</div><!-- .app-wrap -->

<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="/static/app.js"></script>
</body>
</html>`

import { runStaleDealCleanup } from './routes/deals'

// Cloudflare Workers scheduled cron handler
// Configured in wrangler.jsonc: runs daily at 01:00 UTC
export default {
  fetch: app.fetch.bind(app),

  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log(`[cron] triggered: ${event.cron} at ${new Date().toISOString()}`)
    try {
      const result = await runStaleDealCleanup(env.DB)
      console.log(`[cron] stale-deal cleanup: marked ${result.marked} deal(s) as lost`)
      if (result.deals.length) {
        console.log('[cron] affected deals:', result.deals.map((d:any) => `#${d.id} ${d.contact_name || d.title}`).join(', '))
      }
    } catch (err) {
      console.error('[cron] stale-deal cleanup failed:', err)
    }
  }
}
