-- Create system_activities table to store log history
CREATE TABLE IF NOT EXISTS public.system_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL DEFAULT 'System',
  action TEXT NOT NULL,
  module TEXT NOT NULL, -- crm, projects, documents, meetings, finance, support, system
  record_id TEXT,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Turn on row level security
ALTER TABLE public.system_activities ENABLE ROW LEVEL SECURITY;

-- Allow authenticated/public users to read and insert activities
DROP POLICY IF EXISTS "Allow authenticated users to read system_activities" ON public.system_activities;
CREATE POLICY "Allow authenticated users to read system_activities" ON public.system_activities
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert system_activities" ON public.system_activities;
CREATE POLICY "Allow authenticated users to insert system_activities" ON public.system_activities
  FOR INSERT TO public WITH CHECK (true);

-- Enable real-time for system_activities table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add table to publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'system_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_activities;
  END IF;
END
$$;
