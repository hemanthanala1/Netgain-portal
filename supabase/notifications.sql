-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL DEFAULT 'info', -- 'info', 'warning', 'success'
  title text NOT NULL,
  body text NOT NULL,
  time text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Turn on row level security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and update their notifications
-- For now, allowing all authenticated users to see all notifications
CREATE POLICY "Allow authenticated users to read notifications" ON public.notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete notifications" ON public.notifications
  FOR DELETE TO authenticated USING (true);

-- Enable real-time for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
