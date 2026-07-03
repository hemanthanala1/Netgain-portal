-- E-Signature and Document Approval Database Schema for Netgain ERP

-- 1. Document Approvals (Internal Review records)
CREATE TABLE IF NOT EXISTS document_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,          -- 'Quotation', 'Invoice', 'SOW', 'Agreement', 'PRD', 'Marketing', 'Proposal', 'Contract'
    document_id TEXT NOT NULL,            -- Links to the respective document's id
    approver TEXT NOT NULL,               -- User name/email of internal reviewer
    status TEXT NOT NULL,                 -- 'approved', 'rejected', 'revision_requested'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Document Signatures (Client e-signature record)
CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    signature_type TEXT NOT NULL,         -- 'drawn' or 'typed'
    signature_image TEXT,                 -- Base64 encoded drawn signature or SVG
    signature_text TEXT,                  -- Typed representation
    signature_font TEXT,                  -- Font selected for typed signature
    browser TEXT,
    operating_system TEXT,
    device_type TEXT,
    ip_address TEXT,
    document_version INT DEFAULT 1,
    created_by TEXT,                      -- Who created the signing request
    document_hash TEXT,                   -- Secure document SHA-256 hash
    agreement_accepted BOOLEAN DEFAULT TRUE,
    verification_id TEXT NOT NULL UNIQUE, -- E-Signature Audit Certificate / Verification code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Document Timeline / History (Audit logs for each document)
CREATE TABLE IF NOT EXISTS document_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    event TEXT NOT NULL,                  -- 'created', 'internal_review', 'approved', 'rejected', 'sent', 'viewed', 'signed', 'completed', 'needs_revision'
    user_name TEXT NOT NULL,              -- Creator of the event (Employee, Founder, Client name, etc.)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Document Versions (Auditing and version comparison storage)
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    version INT NOT NULL,
    pdf_path TEXT,                        -- Optional path to generated PDF
    document_data JSONB NOT NULL,         -- Full snapshot of the document row data
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(document_type, document_id, version)
);

-- 5. Document Tokens (Secure, temporary access tokens for signing links)
CREATE TABLE IF NOT EXISTS document_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active',         -- 'active', 'used', 'expired', 'cancelled'
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Proposals Table (New Document Type)
CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    project_title TEXT NOT NULL,
    value NUMERIC DEFAULT 0,
    scope TEXT,
    timeline TEXT,
    pricing_details TEXT,
    terms TEXT,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    version INT DEFAULT 1,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. Contracts Table (New Document Type)
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    doc_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    contact TEXT,
    phone TEXT,
    email TEXT,
    type TEXT,                            -- 'Retainer', 'Fixed Bid', 'NDA', 'MOU'
    value NUMERIC DEFAULT 0,
    duration TEXT,
    deliverables TEXT,
    payment_terms TEXT,
    termination_clause TEXT,
    governing_law TEXT,
    status TEXT DEFAULT 'draft',
    created DATE DEFAULT CURRENT_DATE,
    history JSONB DEFAULT '[]'::JSONB,
    version INT DEFAULT 1,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Add helper columns to existing tables
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE sows ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE agreements ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE prds ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE prds ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

ALTER TABLE marketing_reports ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE marketing_reports ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

-- Row Level Security policies (allow full access for easy local setup)
ALTER TABLE document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist to prevent execution errors
DROP POLICY IF EXISTS "Public Full Access Doc Approvals" ON document_approvals;
DROP POLICY IF EXISTS "Public Full Access Doc Signatures" ON document_signatures;
DROP POLICY IF EXISTS "Public Full Access Doc Timeline" ON document_timeline;
DROP POLICY IF EXISTS "Public Full Access Doc Versions" ON document_versions;
DROP POLICY IF EXISTS "Public Full Access Doc Tokens" ON document_tokens;
DROP POLICY IF EXISTS "Public Full Access Proposals" ON proposals;
DROP POLICY IF EXISTS "Public Full Access Contracts" ON contracts;

CREATE POLICY "Public Full Access Doc Approvals" ON document_approvals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Doc Signatures" ON document_signatures FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Doc Timeline" ON document_timeline FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Doc Versions" ON document_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Doc Tokens" ON document_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Proposals" ON proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Contracts" ON contracts FOR ALL USING (true) WITH CHECK (true);

-- 8. Client Accounts Table (For direct client portal login)
CREATE TABLE IF NOT EXISTS client_accounts (
    id TEXT PRIMARY KEY,                  -- Same as crm_clients.id
    client_id TEXT REFERENCES crm_clients(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,               -- Plain text or sha256 hashed
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Client Accounts" ON client_accounts;
CREATE POLICY "Public Full Access Client Accounts" ON client_accounts FOR ALL USING (true) WITH CHECK (true);
