-- SQL Migration to support editable terms & conditions per document

-- 1. Alter quotations table to support specific quotation terms
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS validity_days INTEGER;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_terms_one_time TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS payment_terms_monthly TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS extra_terms TEXT;

-- 2. Alter invoices table to support specific invoice terms and overrides
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_terms TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_payment_instructions TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_footer TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_additional_text TEXT;

-- 3. Universal custom_terms column for edit overrides
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS custom_terms TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS custom_terms TEXT;
ALTER TABLE sows ADD COLUMN IF NOT EXISTS custom_terms TEXT;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS custom_terms TEXT;

-- 4. Enable realtime publication for documents
DO $$
DECLARE
  tbl RECORD;
BEGIN
  -- Create publication if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add tables to publication if they are not already in it
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES ('quotations'), ('invoices'), ('sows'), ('agreements'), ('prds'), ('marketing_reports')
    ) AS t(tablename)
  Loop
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = tbl.tablename
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl.tablename
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl.tablename);
    END IF;
  END LOOP;
END
$$;

