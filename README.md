# Amberway Equine CRM

## 🐴 Project Overview
**Full-featured CRM system for Amberway Equine LLC** - Everything for the barn, but the barn.

A comprehensive customer relationship management system built specifically for Amberway Equine's business model: selling high-quality barn and equine equipment (stalls, fencing, lighting, flooring, fans, horse walkers, treadmills, therapeutic solutions, fly systems, arena footing) from conception to installation.

---

## 🌐 URLs
- **Production**: https://amberway-crm.pages.dev
- **Dashboard**: https://amberway-crm.pages.dev/

---

## ✅ Completed Features

### 🎯 Pipeline Management
- Full visual Kanban board with 11 pipeline stages
- Drag-friendly stage progression from Lead → Completed
- Deal value tracking with pipeline totals per stage
- Priority levels (Low/Medium/High/Urgent)
- Product category tagging (stalls, fencing, lighting, etc.)
- One-click stage updates

### 👥 Contacts & Companies
- Full contact management (name, email, phone, mobile, title, source, location)
- Company/organization management
- Contact type tracking (Lead, Prospect, Customer)
- Source tracking (website, referral, trade show, design center, etc.)
- Preferred contact method (email, phone, text)
- Last contacted date tracking

### 📧 Communications Hub
- **Gmail Integration**: Send/receive emails via Gmail API (OAuth2)
- **SMS via Twilio**: Send/receive text messages
- **Call Logging**: Log inbound/outbound calls with duration and notes
- **Note Taking**: Internal notes on deals/contacts
- Full communication timeline per contact and deal
- Inbound SMS handling via Twilio webhook
- Gmail inbox sync to auto-log emails and match contacts

### 📋 Task & Reminder System
- Smart AI-generated tasks based on deal stage
- Task types: Follow-up, Call, Email, Meeting, Quote Request, Order Check, Delivery Check
- Due date tracking with overdue alerts on dashboard
- Priority-based task ordering
- Snooze tasks (1-7 days)
- Batch complete, snooze, or delete
- Auto-task creation when new deals are created

### 💰 Estimates & Invoices
- Create and track estimates with line items
- Estimate validity dates
- Invoice management with due date tracking
- One-click "Mark as Paid" 
- Auto deal stage update when invoice is paid
- **QuickBooks Online Integration** (OAuth2) for syncing estimates/invoices
- Overdue invoice highlighting

### 🛒 Purchase Orders
- Full PO management with status workflow:
  Draft → Quote Requested → Quote Received → Approved → Submitted → Confirmed → Shipped → Received
- Automatic supplier quote request emails
- Line item management
- Deal stage auto-updates based on PO status
- Supplier management with product categories and lead times

### 🚚 Shipment Tracking
- Multi-carrier tracking support (UPS, FedEx, USPS, Estes, XPO, ABF, Old Dominion)
- Auto-generate tracking links for each carrier
- Customer notifications when orders ship
- Shipment history per deal/PO
- Tracking number from email or manual entry

### 🤖 AI Pipeline Analysis
- Deal status summaries using GPT-4o-mini (when OpenAI API key configured)
- Smart rule-based fallback analysis (no API key needed)
- Next action recommendations per stage
- Risk level assessment
- Auto-analyze on request
- AI-powered task generation per deal stage

### 📊 Dashboard
- Real-time KPIs: Active deals, contacts, open invoices, pending orders
- Pipeline chart (deals by stage)
- Revenue trend chart (monthly)
- Overdue tasks widget
- Recent activity feed
- Active orders tracker
- Unread notifications panel
- Auto-refresh every 5 minutes

### 🔔 Notification System
- Payment received alerts → immediate prompt to place order
- Shipment update notifications
- Inbound SMS/email notifications
- Deal stage change alerts
- Quote request confirmations
- Mark read / Mark all read

### ⚙️ Settings & Integrations
- Gmail OAuth2 connection
- QuickBooks Online OAuth2 connection
- Twilio SMS/Voice configuration
- OpenAI API key for AI features
- Business settings (follow-up days, estimate validity, invoice due days, tax rate)
- Step-by-step integration setup guides

### 🔍 Global Search
- Real-time search across contacts, deals, and companies
- Click to open results directly

---

## 🏗️ Data Architecture

### Storage
- **Cloudflare D1** (SQLite): Primary database
  - Database: `amberway-crm-production`
  - ID: `48e29101-241e-41cc-a843-73c7e99cf93c`

### Database Tables
| Table | Purpose |
|-------|---------|
| `contacts` | Customer/lead/prospect contact records |
| `companies` | Organization records |
| `deals` | Pipeline opportunities |
| `communications` | All emails, SMS, calls, notes |
| `tasks` | Tasks and reminders |
| `estimates` | Customer estimates/quotes |
| `invoices` | Customer invoices |
| `purchase_orders` | Supplier orders |
| `suppliers` | Supplier catalog |
| `shipments` | Shipment tracking |
| `products` | Product catalog |
| `activity_log` | Full audit trail |
| `notifications` | System notifications |
| `settings` | CRM configuration |
| `email_templates` | Reusable email templates |

---

## 🔑 Integration Setup

### Gmail
1. Google Cloud Console → Create OAuth2 credentials
2. Set `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` as Cloudflare secrets
3. Go to Settings → Click "Connect Gmail"

### Twilio (SMS & Calls)
1. Sign up at twilio.com, get a phone number
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` as secrets
3. Set webhook URL: `https://amberway-crm.pages.dev/api/communications/twilio-webhook`

### QuickBooks Online
1. developer.intuit.com → Create app (accounting scope)
2. Set `QB_CLIENT_ID` + `QB_CLIENT_SECRET` as Cloudflare secrets
3. Go to Settings → Click "Connect QuickBooks"

### AI (OpenAI)
1. Get API key from platform.openai.com
2. Set `OPENAI_API_KEY` as Cloudflare secret

### Set Cloudflare Secrets
```bash
npx wrangler pages secret put GMAIL_CLIENT_ID --project-name amberway-crm
npx wrangler pages secret put GMAIL_CLIENT_SECRET --project-name amberway-crm
npx wrangler pages secret put GMAIL_REFRESH_TOKEN --project-name amberway-crm
npx wrangler pages secret put TWILIO_ACCOUNT_SID --project-name amberway-crm
npx wrangler pages secret put TWILIO_AUTH_TOKEN --project-name amberway-crm
npx wrangler pages secret put TWILIO_PHONE_NUMBER --project-name amberway-crm
npx wrangler pages secret put QB_CLIENT_ID --project-name amberway-crm
npx wrangler pages secret put QB_CLIENT_SECRET --project-name amberway-crm
npx wrangler pages secret put OPENAI_API_KEY --project-name amberway-crm
```

---

## 🚀 Deployment

- **Platform**: Cloudflare Pages + D1
- **Status**: ✅ Active
- **Tech Stack**: Hono + TypeScript + TailwindCSS + Chart.js + D1 SQLite
- **Last Updated**: February 2026

## 📁 Project Structure
```
webapp/
├── src/
│   ├── index.tsx              # Main app + HTML template
│   ├── types.ts               # TypeScript types
│   ├── lib/db.ts              # DB helpers
│   └── routes/
│       ├── contacts.ts        # Contact CRUD API
│       ├── deals.ts           # Pipeline/Deal API
│       ├── communications.ts  # Email/SMS/Call API
│       ├── tasks.ts           # Task/Reminder API
│       ├── purchase-orders.ts # PO + Supplier API
│       └── api.ts             # Dashboard/AI/QB/Settings
├── public/static/
│   └── app.js                 # Full frontend SPA (~90KB)
├── migrations/
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_data.sql
└── ecosystem.config.cjs       # PM2 dev server config
```
