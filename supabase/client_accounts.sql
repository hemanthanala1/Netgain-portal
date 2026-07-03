-- ============================================================
-- Client Portal Accounts Table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS client_accounts (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES crm_clients(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE client_accounts ENABLE ROW LEVEL SECURITY;

-- Allow full access (admin portal manages this server-side)
DROP POLICY IF EXISTS "Full Access Client Accounts" ON client_accounts;
CREATE POLICY "Full Access Client Accounts" ON client_accounts
    FOR ALL USING (true) WITH CHECK (true);

-- Index for fast email lookups at login
CREATE INDEX IF NOT EXISTS idx_client_accounts_email ON client_accounts(email);
CREATE INDEX IF NOT EXISTS idx_client_accounts_client_id ON client_accounts(client_id);

-- ============================================================
-- Done! Client portal accounts table is ready.
-- ============================================================
