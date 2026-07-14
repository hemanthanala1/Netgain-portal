-- Add template_id column to documents tables to support custom template selection
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern';
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern';
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
