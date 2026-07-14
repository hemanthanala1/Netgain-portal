-- Rebuild Support Center SQL Migration
-- 1. Ensure client_notifications columns are updated/created
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'general';
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS timeline jsonb DEFAULT '[]'::jsonb;

-- 2. Create support_messages table for conversational thread
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.client_notifications(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL, -- 'client' or 'team'
    message TEXT NOT NULL,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Public Full Access Support Messages" ON public.support_messages;
CREATE POLICY "Public Full Access Support Messages" ON public.support_messages FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Realtime Publications
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  END IF;
END
$$;
