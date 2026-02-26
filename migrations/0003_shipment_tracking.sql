-- Migration 0003: Enhanced Shipment Tracking System
-- Only adds columns that don't exist yet in the shipments table

ALTER TABLE shipments ADD COLUMN carrier_code TEXT;          -- ups, fedex, usps, estes, xpo, other
ALTER TABLE shipments ADD COLUMN last_status TEXT;           -- label_created, in_transit, out_for_delivery, delivered, exception
ALTER TABLE shipments ADD COLUMN last_event TEXT;            -- human readable last event description
ALTER TABLE shipments ADD COLUMN check_count INTEGER DEFAULT 0;
ALTER TABLE shipments ADD COLUMN delivered_at DATETIME;
ALTER TABLE shipments ADD COLUMN customer_notified_at DATETIME;
ALTER TABLE shipments ADD COLUMN followup_task_id INTEGER;
ALTER TABLE shipments ADD COLUMN eta_date DATE;
ALTER TABLE shipments ADD COLUMN notes TEXT;

-- Indexes for polling queries
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_po ON shipments(purchase_order_id);
