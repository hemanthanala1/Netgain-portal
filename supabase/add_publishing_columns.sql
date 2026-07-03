-- Migration: Add publishing columns and client_notifications table

-- 1. Quotations
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS published_version INT DEFAULT 1;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS visibility_status TEXT DEFAULT 'visible';
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 2. SOWs
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS published_version INT DEFAULT 1;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS visibility_status TEXT DEFAULT 'visible';
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 3. Invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS published_version INT DEFAULT 1;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS visibility_status TEXT DEFAULT 'visible';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 4. Agreements
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS published_version INT DEFAULT 1;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS visibility_status TEXT DEFAULT 'visible';
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 5. Marketing Reports
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS published_by TEXT;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS published_version INT DEFAULT 1;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS visibility_status TEXT DEFAULT 'visible';
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 6. Create client_notifications table
CREATE TABLE IF NOT EXISTS public.client_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,               -- Can be company name or client email
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Full Access Notifications" ON public.client_notifications FOR ALL USING (true) WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
