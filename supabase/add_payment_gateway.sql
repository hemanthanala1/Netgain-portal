-- Migration to add payment gateway configurations and tracking

-- 1. Add payment JSONB column to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS payment jsonb DEFAULT '{}'::jsonb;

-- 2. Add payment tracking columns to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_gateway TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_order_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_signature TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;
