-- SQL Migration to support CRM Realtime updates for Notes, Timeline/Activities

-- 1. Create crm_notes table
CREATE TABLE IF NOT EXISTS public.crm_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author TEXT DEFAULT 'Staff Member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Create crm_activities table (for manual timeline event logging)
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL REFERENCES public.crm_clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- call, email, meeting, task, note, document, other
    description TEXT NOT NULL,
    activity_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Enable Row-Level Security
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- 4. Create Public Policies
DROP POLICY IF EXISTS "Public Full Access CRM Notes" ON public.crm_notes;
CREATE POLICY "Public Full Access CRM Notes" ON public.crm_notes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access CRM Activities" ON public.crm_activities;
CREATE POLICY "Public Full Access CRM Activities" ON public.crm_activities FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime Publications
DO $$
DECLARE
  tbl RECORD;
BEGIN
  -- Create publication if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add new CRM tables to the realtime publication
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES ('crm_notes'), ('crm_activities'), ('crm_clients')
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
    END IF;
  END LOOP;
END
$$;
