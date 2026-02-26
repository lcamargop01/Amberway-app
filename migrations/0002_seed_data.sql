-- Seed data for Amberway Equine CRM

-- Settings
INSERT OR IGNORE INTO settings (key, value, type, description) VALUES
  ('company_name', 'Amberway Equine LLC', 'text', 'Company name'),
  ('company_email', 'info@amberwayequine.com', 'text', 'Primary company email'),
  ('company_phone', '', 'text', 'Primary company phone'),
  ('company_website', 'https://www.amberwayequine.com', 'text', 'Company website'),
  ('gmail_connected', 'false', 'boolean', 'Gmail integration status'),
  ('quickbooks_connected', 'false', 'boolean', 'QuickBooks integration status'),
  ('twilio_connected', 'false', 'boolean', 'Twilio SMS/Voice integration status'),
  ('openai_enabled', 'false', 'boolean', 'AI analysis enabled'),
  ('tax_rate_default', '0', 'number', 'Default tax rate percentage'),
  ('follow_up_reminder_days', '3', 'number', 'Days before auto follow-up reminder'),
  ('estimate_valid_days', '30', 'number', 'Default estimate validity in days'),
  ('invoice_due_days', '30', 'number', 'Default invoice due days'),
  ('notification_email', '', 'text', 'Email for internal notifications'),
  ('twilio_phone_number', '', 'text', 'Twilio phone number for SMS/calls'),
  ('ai_auto_analyze', 'true', 'boolean', 'Auto-run AI analysis on new communications');

-- Sample suppliers
INSERT OR IGNORE INTO companies (name, type, website, email, phone, notes) VALUES
  ('Lucas Equine Equipment', 'supplier', 'https://lucasequine.com', 'sales@lucasequine.com', '', 'Horse stalls and gates manufacturer'),
  ('Cool Barns', 'supplier', 'https://coolbarns.com', 'info@coolbarns.com', '', 'Barn fans and ventilation systems'),
  ('Kraft Horse Walkers', 'supplier', '', 'sales@krafthorsewalkers.com', '', 'Horse walkers and treadmills'),
  ('EquiLumination', 'supplier', '', 'info@equilumination.com', '', 'Equine lighting systems'),
  ('StableComfort by Promat', 'supplier', '', 'info@promat.com', '', 'Stall mats and flooring'),
  ('Pavesafe', 'supplier', '', 'sales@pavesafe.com', '', 'Rubber pavers and footing');

INSERT OR IGNORE INTO suppliers (name, contact_name, email, product_categories, lead_time_days) VALUES
  ('Lucas Equine Equipment', 'Sales Team', 'sales@lucasequine.com', '["stalls_gates"]', 21),
  ('Cool Barns', 'Sales Team', 'info@coolbarns.com', '["fans_ventilation"]', 14),
  ('Kraft Horse Walkers', 'Sales Team', 'sales@krafthorsewalkers.com', '["horse_walkers","treadmills"]', 28),
  ('EquiLumination', 'Sales Team', 'info@equilumination.com', '["lighting"]', 14),
  ('StableComfort', 'Sales Team', 'info@promat.com', '["flooring"]', 10),
  ('Pavesafe', 'Sales Team', 'sales@pavesafe.com', '["flooring","arenas"]', 10);

-- Sample products
INSERT OR IGNORE INTO products (name, sku, category, description, cost_price, sell_price, unit, lead_time_days) VALUES
  ('Lucas Standard Horse Stall', 'LUC-STALL-STD', 'stalls_gates', '12x12 Standard Horse Stall with sliding door', 1800, 2800, 'each', 21),
  ('Lucas Premium Horse Stall', 'LUC-STALL-PREM', 'stalls_gates', '12x12 Premium Horse Stall with custom features', 2500, 3800, 'each', 21),
  ('Lucas Stall Gate', 'LUC-GATE-STD', 'stalls_gates', 'Standard sliding stall gate', 400, 650, 'each', 21),
  ('Cool Barns 72" Fan', 'CB-FAN-72', 'fans_ventilation', '72 inch high-velocity barn fan', 450, 750, 'each', 14),
  ('Cool Barns 54" Fan', 'CB-FAN-54', 'fans_ventilation', '54 inch barn fan', 320, 520, 'each', 14),
  ('EquiLumination LED Barn Light', 'EL-LED-BARN', 'lighting', 'Energy-efficient LED barn light fixture', 180, 320, 'each', 14),
  ('StableComfort Stall Mat', 'SC-MAT-STD', 'flooring', '4x6 ft rubber stall mat, 3/4 inch thick', 45, 89, 'each', 10),
  ('Pavesafe Rubber Pavers', 'PS-PAVER-STD', 'flooring', 'Rubber pavers for barn aisle and walkways', 8, 18, 'sq_ft', 10),
  ('Kraft Walker 4-Horse', 'KW-4H', 'horse_walkers', '4-horse automatic walker', 8500, 14000, 'each', 28),
  ('HDPE Fencing Panel', 'HDPE-FENCE-8', 'fencing', '8-foot HDPE board fencing panel', 65, 120, 'each', 14),
  ('Fly Spray System', 'FLY-AUTO-SYS', 'fly_systems', 'Automatic fly spray system for 4 stalls', 280, 480, 'each', 14),
  ('Arena Sand Footing', 'ARENA-SAND', 'arenas', 'Premium arena sand footing per cubic yard', 35, 65, 'cubic_yard', 7);

-- Email templates
INSERT OR IGNORE INTO email_templates (name, type, subject, body) VALUES
  ('Welcome Lead', 'welcome', 'Welcome to Amberway Equine - {{first_name}}!', 
   '<p>Dear {{first_name}},</p><p>Thank you for your interest in Amberway Equine! We specialize in high-quality barn and arena products for private facilities, boarding operations, and racing operations.</p><p>We would love to learn more about your project. Could you share some details about what you are looking to accomplish?</p><p>Our team is ready to help you from conception to installation.</p><p>Best regards,<br>The Amberway Equine Team<br>Wellington, FL | Lexington, KY</p>'),
  
  ('Follow Up - No Response', 'follow_up', 'Following up on your barn project - {{first_name}}',
   '<p>Hi {{first_name}},</p><p>I wanted to follow up on your inquiry about {{product_interest}}. I know you are busy, and I want to make sure you have everything you need to move forward with your barn project.</p><p>Would you have 15 minutes for a quick call this week? I can walk you through our options and answer any questions.</p><p>Best,<br>Amberway Equine Team</p>'),

  ('Estimate Sent', 'estimate', 'Your Amberway Equine Estimate #{{estimate_number}}',
   '<p>Dear {{first_name}},</p><p>Thank you for the opportunity to provide a quote for your project. Please find your estimate attached.</p><p><strong>Estimate #{{estimate_number}}</strong><br>Total: ${{total}}<br>Valid Until: {{valid_until}}</p><p>To accept this estimate, simply click the link below or reply to this email. Once accepted, we will send over an invoice to get things moving.</p><p>Please do not hesitate to reach out with any questions.</p><p>Best regards,<br>Amberway Equine Team</p>'),

  ('Invoice Sent', 'invoice', 'Invoice #{{invoice_number}} from Amberway Equine',
   '<p>Dear {{first_name}},</p><p>Thank you for accepting our estimate! Please find your invoice attached.</p><p><strong>Invoice #{{invoice_number}}</strong><br>Amount Due: ${{amount_due}}<br>Due Date: {{due_date}}</p><p>Once payment is received, we will immediately place your order with our suppliers and keep you updated every step of the way.</p><p>Thank you for your business!</p><p>Best regards,<br>Amberway Equine Team</p>'),

  ('Order Placed', 'order_update', 'Great news! Your order has been placed - {{first_name}}',
   '<p>Dear {{first_name}},</p><p>We are excited to let you know that your order has been placed with our suppliers! Here is what to expect next:</p><ul><li>We will confirm availability and lead times within 24-48 hours</li><li>You will receive tracking information as soon as items ship</li><li>Our team will coordinate delivery/installation details with you</li></ul><p>Estimated delivery: {{expected_delivery}}</p><p>Feel free to reach out anytime with questions!</p><p>Best,<br>Amberway Equine Team</p>'),

  ('Shipping Update', 'shipping_update', 'Your Amberway Equine order is on its way! 🐴',
   '<p>Dear {{first_name}},</p><p>Great news! Your order has shipped!</p><p><strong>Tracking Information:</strong><br>Carrier: {{carrier}}<br>Tracking #: {{tracking_number}}<br>Track your order: <a href="{{tracking_url}}">Click here</a></p><p>Estimated Delivery: {{estimated_delivery}}</p><p>We will notify you when your order is delivered. Thank you for choosing Amberway Equine!</p><p>Best,<br>Amberway Equine Team</p>'),

  ('Quote Request to Supplier', 'quote_request', 'Quote Request - {{project_name}}',
   '<p>Hello,</p><p>We would like to request a quote for the following items for a customer project:</p><p><strong>Project:</strong> {{project_name}}<br><strong>Customer Location:</strong> {{customer_location}}</p><p><strong>Items Needed:</strong><br>{{line_items}}</p><p>Please provide pricing, availability, and lead times at your earliest convenience.</p><p>Thank you,<br>Amberway Equine Team</p>'),

  ('Delivery Confirmed', 'delivery', 'Your order has been delivered! - {{first_name}}',
   '<p>Dear {{first_name}},</p><p>Your order has been delivered! We hope everything arrived in perfect condition.</p><p>If you have any questions or need any assistance, please do not hesitate to reach out. We are always here to help.</p><p>We would love to hear how everything turned out - feel free to share photos of your barn!</p><p>Thank you for choosing Amberway Equine. We look forward to working with you again!</p><p>Warmly,<br>Amberway Equine Team</p>');
