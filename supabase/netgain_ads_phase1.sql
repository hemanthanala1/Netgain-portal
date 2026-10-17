-- ==============================================================================
-- NETGAIN ADS MODULE — PHASE 1 DATABASE MIGRATION
-- Report Uploads, Structured Metrics Storage, Client Publication & Audit Logs
-- ==============================================================================

-- 1. ADS REPORTS TABLE
-- Stores uploaded ad performance reports, their metadata, publication status,
-- and structured parsed data linked to crm_clients.
CREATE TABLE IF NOT EXISTS public.ads_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    report_name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'meta' CHECK (platform IN ('meta', 'google')),
    period_start DATE,
    period_end DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'replaced')),
    published_to_client BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    published_by TEXT,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_mime_type TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'ads-reports',
    storage_path TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
    parsed_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for fast client queries, publication filtering, and date sorting
CREATE INDEX IF NOT EXISTS idx_ads_reports_client_id ON public.ads_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_reports_status ON public.ads_reports(status);
CREATE INDEX IF NOT EXISTS idx_ads_reports_published ON public.ads_reports(client_id, published_to_client);
CREATE INDEX IF NOT EXISTS idx_ads_reports_created_at ON public.ads_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_reports_period ON public.ads_reports(period_start, period_end);

-- 2. ADS AUDIT LOGS TABLE
-- Tracks all uploads, replacements, publications, unpublications, and deletions.
CREATE TABLE IF NOT EXISTS public.ads_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_email TEXT,
    action TEXT NOT NULL,
    report_id UUID REFERENCES public.ads_reports(id) ON DELETE SET NULL,
    client_id TEXT REFERENCES public.crm_clients(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ads_audit_logs_report_id ON public.ads_audit_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_ads_audit_logs_client_id ON public.ads_audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_audit_logs_created_at ON public.ads_audit_logs(created_at DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Zero-Trust Isolation: Public anonymous access blocked; Staff gated by role
-- ==============================================================================

ALTER TABLE public.ads_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Deny all public anonymous access
DROP POLICY IF EXISTS "Deny anon access to ads_reports" ON public.ads_reports;
CREATE POLICY "Deny anon access to ads_reports" ON public.ads_reports FOR ALL TO anon USING (false);

DROP POLICY IF EXISTS "Deny anon access to ads_audit_logs" ON public.ads_audit_logs;
CREATE POLICY "Deny anon access to ads_audit_logs" ON public.ads_audit_logs FOR ALL TO anon USING (false);

-- 2. Staff Access: Founders & Admins have full access
DROP POLICY IF EXISTS "Staff manage ads_reports" ON public.ads_reports;
CREATE POLICY "Staff manage ads_reports" ON public.ads_reports FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

DROP POLICY IF EXISTS "Staff view ads_audit_logs" ON public.ads_audit_logs;
CREATE POLICY "Staff view ads_audit_logs" ON public.ads_audit_logs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

-- ==============================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION (RUN IN SUPABASE STORAGE / SQL EDITOR)
-- ==============================================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('ads-reports', 'ads-reports', false)
-- ON CONFLICT (id) DO UPDATE SET public = false;
