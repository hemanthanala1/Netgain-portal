-- SQL Migration to enable Supabase Realtime for Document Vault tables

-- 1. Ensure the supabase_realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- 2. Add document tables to the publication
-- (If any table is already added, it will be skipped automatically)
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES 
        ('quotations'), 
        ('invoices'), 
        ('sows'), 
        ('agreements'), 
        ('prds'), 
        ('marketing_reports')
    ) AS t(tablename)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = tbl.tablename
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl.tablename
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl.tablename);
      RAISE NOTICE 'Added table % to supabase_realtime publication', tbl.tablename;
    END IF;
  END LOOP;
END
$$;
