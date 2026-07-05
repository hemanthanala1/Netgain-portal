-- Migration to add custom_subtotal to quotations and invoices, and email to agreements
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS custom_subtotal NUMERIC;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS custom_subtotal NUMERIC;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS email TEXT;
