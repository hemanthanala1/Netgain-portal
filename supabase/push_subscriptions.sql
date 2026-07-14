-- Push Subscriptions table for Web Push Notifications
-- Stores browser PushSubscription objects for admin and client portal users

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type text NOT NULL CHECK (user_type IN ('admin', 'client')),
  -- For admin users: the Supabase auth user ID
  -- For client users: the client email address
  user_id text NOT NULL,
  -- For client users only: the company name (used for targeting by company)
  client_company text,
  -- The full PushSubscription JSON object from the browser
  subscription jsonb NOT NULL,
  -- Device/browser fingerprint for deduplication
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookups by user_type + user_id
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx 
  ON public.push_subscriptions (user_type, user_id);

-- Index for fast lookups by client_company (admin sending to client)
CREATE INDEX IF NOT EXISTS push_subscriptions_company_idx 
  ON public.push_subscriptions (client_company);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.push_subscriptions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trigger_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.push_subscriptions_set_updated_at();

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admin users can manage their own subscriptions (matched by auth.uid())
CREATE POLICY "push_subs_admin_own" ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_type = 'admin' AND user_id = auth.uid()::text)
  WITH CHECK (user_type = 'admin' AND user_id = auth.uid()::text);

-- Allow anon (client portal uses no auth) to insert their own subscriptions
-- We scope this narrowly — clients can only insert/delete, not read others
CREATE POLICY "push_subs_client_insert" ON public.push_subscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_type = 'client');

CREATE POLICY "push_subs_client_delete" ON public.push_subscriptions
  FOR DELETE
  TO anon, authenticated
  USING (user_type = 'client');

-- Service role bypass — server-side push sender reads all rows
-- (No policy needed; service_role bypasses RLS by default)

-- Enable realtime (optional — for future admin dashboard showing who's subscribed)
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
