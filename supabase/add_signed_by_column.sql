-- Migration: Add signed_by column to all document tables
-- Run this in Supabase SQL Editor

ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.marketing_reports ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.prds ADD COLUMN IF NOT EXISTS signed_by TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
