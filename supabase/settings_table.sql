-- Settings table for storing company-wide and user settings in Supabase
-- Replaces local .nbos-settings.json file

-- 1) Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc', now()),
  UNIQUE(user_id, key)
);

-- 2) Alternative: single settings document per user (recommended for company-wide settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company jsonb DEFAULT '{}'::jsonb,
  founder jsonb DEFAULT '{}'::jsonb,
  bank jsonb DEFAULT '{}'::jsonb,
  comm jsonb DEFAULT '{}'::jsonb,
  ai jsonb DEFAULT '{}'::jsonb,
  docs jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc', now()),
  UNIQUE(user_id)
);

-- Ensure docs column exists for existing tables
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS docs jsonb DEFAULT '{}'::jsonb;

-- 3) Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies for company_settings (only user and founders/admins can access)
DROP POLICY IF EXISTS "Users can read own settings" ON public.company_settings;
CREATE POLICY "Users can read own settings" ON public.company_settings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.company_settings;
CREATE POLICY "Users can update own settings" ON public.company_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Founders/admins manage all settings" ON public.company_settings;
CREATE POLICY "Founders/admins manage all settings" ON public.company_settings
  FOR ALL
  USING (
    current_setting('jwt.claims.role', true) = 'Founder' OR
    current_setting('jwt.claims.role', true) = 'Admin'
  );

-- 5) Auto-update `updated_at` on company_settings changes
CREATE OR REPLACE FUNCTION public.company_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_company_settings_set_updated_at ON public.company_settings;
CREATE TRIGGER trigger_company_settings_set_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.company_settings_set_updated_at();

-- 6) Guidance notes:
-- Use the `company_settings` table to store company-wide settings (company info, founder details, bank info, etc.)
-- Each founder/admin has their own row with user_id = their auth.users.id
-- When a founder updates settings, only their row is updated
-- Queries should filter by current auth.uid() to get their settings

-- End of file
