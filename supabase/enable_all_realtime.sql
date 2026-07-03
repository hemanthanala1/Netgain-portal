-- SQL Migration to enable Supabase Realtime for ALL tables in the portal (CRM, Documents, E-Sign, Meetings)

-- 1. Ensure the supabase_realtime publication exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- 2. Add all system tables to the supabase_realtime publication
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES 
        -- ERP Documents
        ('quotations'), 
        ('invoices'), 
        ('sows'), 
        ('agreements'), 
        ('prds'), 
        ('marketing_reports'),
        -- E-Sign & Client Portals
        ('proposals'),
        ('contracts'),
        ('document_signatures'),
        ('document_timeline'),
        ('document_approvals'),
        ('document_tokens'),
        ('client_accounts'),
        ('profiles'),
        -- CRM
        ('crm_clients'),
        ('crm_notes'),
        ('crm_activities'),
        -- Meetings
        ('meetings'),
        -- General
        ('team_members'),
        ('services'),
        ('company_settings')
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
