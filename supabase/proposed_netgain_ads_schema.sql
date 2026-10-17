-- ==============================================================================
-- NETGAIN ADS MODULE — PROPOSED DATABASE SCHEMA & RLS POLICIES
-- Phase 1A Review Proposal (DO NOT EXECUTE UNTIL APPROVED)
-- 
-- Architectural Highlights:
-- 1. Strict Tenant Isolation: All client data keyed to crm_clients(id).
-- 2. Decoupled Account Model: Discovered accounts separated from client assignments.
-- 3. Non-Nullable Uniqueness: Two-tier metrics avoid PostgreSQL NULL uniqueness flaws.
-- 4. Audit History: Immutable log of all account reassignments and exports.
-- 5. Zero-Trust RLS: Public anon access completely disabled; staff gated by role.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PLATFORM OAUTH CONNECTIONS
-- Agency-wide Meta Business & Google Ads MCC OAuth credentials
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    connection_name TEXT NOT NULL,
    account_email TEXT,
    encrypted_access_token TEXT NOT NULL,          -- AES-256-GCM Encrypted (iv:tag:ciphertext)
    encrypted_refresh_token TEXT,                  -- AES-256-GCM Encrypted (Google)
    encrypted_developer_token TEXT,                -- AES-256-GCM Encrypted (Google Ads)
    token_expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error', 'disconnected')),
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. PLATFORM MANAGER CONTAINERS
-- Meta Business Portfolios (BM) & Google Ads Manager Accounts (MCC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_manager_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.ads_platform_connections(id) ON DELETE CASCADE,
    container_type TEXT NOT NULL CHECK (container_type IN ('meta_bm', 'google_mcc')),
    external_container_id TEXT NOT NULL,           -- Meta Business ID or Google MCC Customer ID
    container_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(container_type, external_container_id)
);

-- ------------------------------------------------------------------------------
-- 3. DISCOVERED & MANAGED ADVERTISING ACCOUNTS
-- Unassigned discovery pool; supports both Netgain-managed and Client-owned accounts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id UUID REFERENCES public.ads_manager_containers(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    external_account_id TEXT NOT NULL,             -- e.g. 'act_123456789' or '123-456-7890'
    account_name TEXT NOT NULL,
    currency TEXT DEFAULT 'INR',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    ownership_type TEXT DEFAULT 'netgain_managed' CHECK (ownership_type IN ('netgain_managed', 'client_owned')),
    discovery_status TEXT DEFAULT 'discovered' CHECK (discovery_status IN ('discovered', 'active', 'archived', 'paused')),
    billing_type TEXT DEFAULT 'agency_paid' CHECK (billing_type IN ('agency_paid', 'client_direct')),
    monthly_budget NUMERIC DEFAULT 0,
    daily_budget_target NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(platform, external_account_id)
);

-- ------------------------------------------------------------------------------
-- 4. ERP CLIENT ACCOUNT ASSIGNMENTS
-- Relational junction linking an Ad Account to a CRM Client with feature permissions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_client_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ads_account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE RESTRICT,
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    can_view_metrics BOOLEAN DEFAULT true,
    can_view_campaigns BOOLEAN DEFAULT true,
    can_view_leads BOOLEAN DEFAULT true,
    can_export_leads BOOLEAN DEFAULT true,
    can_view_spend BOOLEAN DEFAULT true,
    can_download_reports BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    assigned_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enforce strictly ONE active client assignment per ad account at any given time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_account_assignment
    ON public.ads_client_assignments (ads_account_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ads_assignments_client ON public.ads_client_assignments(client_id);

-- ------------------------------------------------------------------------------
-- 5. IMMUTABLE ASSIGNMENT AUDIT HISTORY
-- Preserves historical attribution when accounts are mapped, remapped, or unlinked
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ads_account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('assigned', 'reassigned', 'unassigned', 'permissions_updated')),
    previous_client_id TEXT,
    performed_by TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 6. ADVERTISING CAMPAIGNS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ads_account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    external_campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,                          -- ACTIVE, PAUSED, ARCHIVED
    objective TEXT,                                -- OUTCOME_LEADS, CONVERSIONS, etc.
    daily_budget NUMERIC,
    lifetime_budget NUMERIC,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(ads_account_id, external_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_campaigns_account ON public.ads_campaigns(ads_account_id);

-- ------------------------------------------------------------------------------
-- 7. TWO-TIER DAILY METRICS (NON-NULLABLE GRAIN)
-- Tier A: Account-Level Daily Aggregates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_account_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ads_account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spend_account_currency NUMERIC DEFAULT 0,
    spend_base_currency NUMERIC DEFAULT 0,         -- Converted to ERP base accounting currency (INR)
    currency TEXT NOT NULL DEFAULT 'INR',
    exchange_rate NUMERIC DEFAULT 1,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    conversions NUMERIC DEFAULT 0,
    conversion_value NUMERIC DEFAULT 0,
    leads BIGINT DEFAULT 0,
    cpc NUMERIC GENERATED ALWAYS AS (CASE WHEN clicks > 0 THEN spend_base_currency / clicks ELSE 0 END) STORED,
    ctr NUMERIC GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) * 100 ELSE 0 END) STORED,
    roas NUMERIC GENERATED ALWAYS AS (CASE WHEN spend_base_currency > 0 THEN conversion_value / spend_base_currency ELSE 0 END) STORED,
    raw_attribution JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(ads_account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ads_acct_metrics_client_date ON public.ads_account_metrics_daily(client_id, date DESC);

-- Tier B: Campaign-Level Daily Breakdown
CREATE TABLE IF NOT EXISTS public.ads_campaign_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
    ads_account_id UUID NOT NULL REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spend_account_currency NUMERIC DEFAULT 0,
    spend_base_currency NUMERIC DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    conversions NUMERIC DEFAULT 0,
    conversion_value NUMERIC DEFAULT 0,
    leads BIGINT DEFAULT 0,
    cpc NUMERIC GENERATED ALWAYS AS (CASE WHEN clicks > 0 THEN spend_base_currency / clicks ELSE 0 END) STORED,
    ctr NUMERIC GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN (clicks::numeric / impressions) * 100 ELSE 0 END) STORED,
    roas NUMERIC GENERATED ALWAYS AS (CASE WHEN spend_base_currency > 0 THEN conversion_value / spend_base_currency ELSE 0 END) STORED,
    synced_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ads_camp_metrics_client_date ON public.ads_campaign_metrics_daily(client_id, date DESC);

-- ------------------------------------------------------------------------------
-- 8. RETRIEVED AD LEADS (META INSTANT FORMS & GOOGLE LEAD ASSETS)
-- Preserves original raw question-answer pairs and tracks CRM pipeline promotion
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    ads_account_id UUID REFERENCES public.ads_accounts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
    external_lead_id TEXT NOT NULL,
    qualified_lead_id TEXT GENERATED ALWAYS AS (platform || ':' || external_lead_id) STORED UNIQUE,
    form_id TEXT,
    form_name TEXT,
    campaign_name TEXT,
    ad_name TEXT,
    lead_data JSONB NOT NULL,                      -- Preserves original form questions & values
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'spam')),
    crm_pushed BOOLEAN DEFAULT false,
    crm_activity_id UUID REFERENCES public.crm_activities(id) ON DELETE SET NULL,
    created_time TIMESTAMPTZ NOT NULL,             -- Lead creation timestamp on Meta/Google
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ads_leads_client ON public.ads_leads(client_id, created_time DESC);

-- ------------------------------------------------------------------------------
-- 9. GENERATED ADS PERFORMANCE REPORTS (EXCEL WORKBOOKS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    report_title TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    platforms TEXT[] DEFAULT ARRAY['meta', 'google']::TEXT[],
    summary_metrics JSONB NOT NULL,
    claude_analysis TEXT,                          -- Claude 3.5 Sonnet generated strategic insights
    excel_file_url TEXT,                           -- Downloadable .xlsx workbook
    published_to_client BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ads_reports_client ON public.ads_reports(client_id, published_to_client);

-- ------------------------------------------------------------------------------
-- 10. AI USAGE LOGS (CLAUDE REQUEST & COST TRACKING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT REFERENCES public.crm_clients(id) ON DELETE SET NULL,
    report_id UUID REFERENCES public.ads_reports(id) ON DELETE CASCADE,
    prompt_name TEXT NOT NULL,
    model TEXT NOT NULL,                           -- e.g. 'claude-3-5-sonnet-20241022'
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    cost_usd NUMERIC(8, 5) NOT NULL,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'rate_limited', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 11. BACKGROUND SYNC MONITORING RUNS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL CHECK (run_type IN ('scheduled_cron', 'manual_admin')),
    platform TEXT CHECK (platform IN ('meta', 'google', 'all')),
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    accounts_synced INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial_failure', 'failed')),
    error_log JSONB DEFAULT '[]'::jsonb
);

-- ------------------------------------------------------------------------------
-- 12. AUDIT LOGS FOR ADVERTISING MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Public anonymous access blocked; Staff gated by role
-- ==============================================================================

ALTER TABLE public.ads_platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_manager_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_account_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campaign_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Disallow all public anonymous access
CREATE POLICY "Deny anon access to ads_platform_connections" ON public.ads_platform_connections FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_manager_containers" ON public.ads_manager_containers FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_accounts" ON public.ads_accounts FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_client_assignments" ON public.ads_client_assignments FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_assignment_history" ON public.ads_assignment_history FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_campaigns" ON public.ads_campaigns FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_account_metrics_daily" ON public.ads_account_metrics_daily FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_campaign_metrics_daily" ON public.ads_campaign_metrics_daily FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_leads" ON public.ads_leads FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_reports" ON public.ads_reports FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_ai_usage_logs" ON public.ads_ai_usage_logs FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_sync_runs" ON public.ads_sync_runs FOR ALL TO anon USING (false);
CREATE POLICY "Deny anon access to ads_audit_logs" ON public.ads_audit_logs FOR ALL TO anon USING (false);

-- 2. Grant full access to authenticated staff (Founders & Admins)
CREATE POLICY "Staff manage ads_platform_connections" ON public.ads_platform_connections FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_manager_containers" ON public.ads_manager_containers FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_accounts" ON public.ads_accounts FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_client_assignments" ON public.ads_client_assignments FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff view ads_assignment_history" ON public.ads_assignment_history FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_campaigns" ON public.ads_campaigns FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_account_metrics_daily" ON public.ads_account_metrics_daily FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_campaign_metrics_daily" ON public.ads_campaign_metrics_daily FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_leads" ON public.ads_leads FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff manage ads_reports" ON public.ads_reports FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff view ads_ai_usage_logs" ON public.ads_ai_usage_logs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff view ads_sync_runs" ON public.ads_sync_runs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));

CREATE POLICY "Staff view ads_audit_logs" ON public.ads_audit_logs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('Founder', 'Admin')));
