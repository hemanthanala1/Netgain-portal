-- Supabase Database Schema for Netgain Operating Portal

-- 1. Custom Roles Table
CREATE TABLE IF NOT EXISTS custom_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_system BOOLEAN DEFAULT FALSE,
    permissions TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT REFERENCES custom_roles(name) ON UPDATE CASCADE,
    status TEXT DEFAULT 'active',
    joined DATE DEFAULT CURRENT_DATE,
    projects INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. CRM Clients Table
CREATE TABLE IF NOT EXISTS crm_clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business TEXT,
    type TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'new',
    revenue NUMERIC DEFAULT 0,
    last_contact DATE DEFAULT CURRENT_DATE,
    city TEXT,
    gst TEXT,
    address TEXT,
    website TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Services Table
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    cat_id TEXT NOT NULL,
    name TEXT NOT NULL,
    pricing TEXT NOT NULL,
    base_price NUMERIC NOT NULL,
    price_min NUMERIC,
    price_max NUMERIC,
    quotation_price NUMERIC,
    timeline TEXT,
    status TEXT DEFAULT 'active',
    deliverables TEXT[] DEFAULT '{}'::TEXT[],
    exclusions TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    phone TEXT,
    business_type TEXT,
    industry TEXT,
    gst TEXT,
    project_title TEXT,
    service_ids TEXT[] DEFAULT '{}'::TEXT[],
    discount_pct NUMERIC DEFAULT 0,
    gst_pct NUMERIC DEFAULT 18,
    notes TEXT,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    valid DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Scope of Work (SOWs) Table
CREATE TABLE IF NOT EXISTS sows (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    project TEXT NOT NULL,
    value NUMERIC DEFAULT 0,
    timeline TEXT,
    objectives TEXT,
    deliverables TEXT,
    milestones TEXT,
    payment TEXT,
    exclusions TEXT,
    revisions TEXT,
    jurisdiction TEXT,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    phone TEXT,
    business_type TEXT,
    gst TEXT,
    service_ids TEXT[] DEFAULT '{}'::TEXT[],
    discount_type TEXT DEFAULT 'percentage',
    discount_value NUMERIC DEFAULT 0,
    gst_pct NUMERIC DEFAULT 18,
    notes TEXT,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    due DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. Client Agreements Table
CREATE TABLE IF NOT EXISTS agreements (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    type TEXT,
    value NUMERIC DEFAULT 0,
    duration TEXT,
    services TEXT,
    ip TEXT,
    cancellation TEXT,
    jurisdiction TEXT,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 9. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    client TEXT NOT NULL,
    stack TEXT,
    status TEXT DEFAULT 'active',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 10. Product Requirement Documents (PRDs) Table
CREATE TABLE IF NOT EXISTS prds (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    client TEXT NOT NULL,
    stack TEXT,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 11. Marketing Reports Table
CREATE TABLE IF NOT EXISTS marketing_reports (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    client TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 12. Finance Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    tax_amount NUMERIC DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 13. Finance Salaries Table
CREATE TABLE IF NOT EXISTS salaries (
    id TEXT PRIMARY KEY,
    employee TEXT NOT NULL,
    role TEXT NOT NULL,
    base_salary NUMERIC NOT NULL,
    bonus NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- ── ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sows ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prds ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

-- Define Policies: Allow all access for authenticated and anonymous users for easy setup
CREATE POLICY "Public Full Access Custom Roles" ON custom_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Team Members" ON team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access CRM Clients" ON crm_clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Quotations" ON quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access SOWs" ON sows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Agreements" ON agreements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access PRDs" ON prds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Marketing Reports" ON marketing_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Salaries" ON salaries FOR ALL USING (true) WITH CHECK (true);


-- ── SEED INITIAL MOCK DATA ─────────────────────────────────────────────

-- 1. Seed Custom Roles
INSERT INTO custom_roles (id, name, is_system, permissions) VALUES
('role-founder', 'Founder', true, ARRAY['all']),
('role-admin', 'Admin', true, ARRAY['crm', 'projects', 'documents', 'team', 'finance', 'marketing']),
('role-pm', 'Project Manager', true, ARRAY['crm', 'projects', 'documents']),
('role-sales', 'Sales Executive', true, ARRAY['crm', 'marketing']),
('role-employee', 'Employee', true, ARRAY['projects'])
ON CONFLICT (id) DO NOTHING;
