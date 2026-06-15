-- SQL Migration to support Meetings & Communication Hub

-- 1. Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cal_booking_uid TEXT UNIQUE,
    calendar_event_id TEXT UNIQUE,
    event_type TEXT,
    client_name TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT,
    meeting_date DATE NOT NULL,
    meeting_time TIME WITHOUT TIME ZONE NOT NULL,
    meeting_duration INTEGER NOT NULL, -- in minutes
    status TEXT NOT NULL DEFAULT 'upcoming', -- upcoming, completed, cancelled, rescheduled, no_show
    meet_link TEXT,
    timezone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Create communication_logs table
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    channel TEXT NOT NULL, -- email, whatsapp, sms
    recipient TEXT NOT NULL,
    subject TEXT, -- for email
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, failed
    provider TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- 4. Enable Public Full Access Policies
DROP POLICY IF EXISTS "Public Full Access Meetings" ON public.meetings;
CREATE POLICY "Public Full Access Meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Communication Logs" ON public.communication_logs;
CREATE POLICY "Public Full Access Communication Logs" ON public.communication_logs FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES ('meetings'), ('communication_logs')
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
