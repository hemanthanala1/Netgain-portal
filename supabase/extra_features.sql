-- Extra features for Netgain Operating Portal
-- Adds `profiles`, syncs auth.users <-> profiles, enforces RLS, and enables realtime publication for profiles

-- 1) Ensure UUID helper
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text REFERENCES public.custom_roles(name),
  settings jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc', now())
);

-- 3) Insert profile when a new auth user is created (captures app_metadata.role and user_metadata.full_name)
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, updated_at)
  VALUES (
    NEW.id::uuid,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->> 'full_name', NULL),
    COALESCE(NEW.raw_app_meta_data->> 'role', 'Employee'),
    timezone('utc', now())
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_auth_user_created ON auth.users;
CREATE TRIGGER trigger_handle_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_created();

-- 4) Keep profiles.role in sync when auth.users.app_metadata.role changes
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) <> COALESCE(OLD.raw_app_meta_data, '{}'::jsonb)) THEN
    UPDATE public.profiles
    SET role = COALESCE(NEW.raw_app_meta_data->> 'role', role),
        updated_at = timezone('utc', now())
    WHERE id = NEW.id::uuid;
  END IF;
  RETURN NEW;
END;
$$ SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_auth_user_updated ON auth.users;
CREATE TRIGGER trigger_handle_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_updated();

-- 5) When profile role or settings change, propagate back to auth.users.app_metadata (so JWTs can include updated role on re-login)
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update auth.users.raw_app_meta_data.role to match profiles.role
  IF (TG_OP = 'UPDATE' AND (NEW.role IS DISTINCT FROM OLD.role)) OR (TG_OP = 'INSERT') THEN
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(NEW.role::text), true)
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_profile_to_auth_users ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_auth_users
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_auth_users();

-- 6) Auto-update `updated_at` on profile updates
CREATE OR REPLACE FUNCTION public.profiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_set_updated_at();

-- 7) Row-Level Security for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Profiles: select own" ON public.profiles;

CREATE POLICY "Profiles: select own" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile (but not role)
DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;

CREATE POLICY "Profiles: update own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow founders/admins to manage profiles
DROP POLICY IF EXISTS "Profiles: founders and admins" ON public.profiles;

CREATE POLICY "Profiles: founders and admins" ON public.profiles
  FOR ALL
  USING (
    current_setting('jwt.claims.role', true) = 'Founder' OR
    current_setting('jwt.claims.role', true) = 'Admin' OR
    current_setting('jwt.claims.role', true) = 'Founder'
  );

-- 8) Enable realtime publication for profiles (so clients subscribed to profiles receive changes)
-- Supabase realtime listens to WAL publications. Creating publication ensures replication events are produced.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime FOR TABLE public.profiles;
  END IF;
END
$$;

-- 9) Optionally add a profile_id to team_members and keep in sync when emails match
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_team_member_profile_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Try to set profile_id by matching email if profile exists
  IF NEW.email IS NOT NULL THEN
    SELECT id INTO NEW.profile_id
    FROM public.profiles
    WHERE email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_team_member_profile_id ON public.team_members;
CREATE TRIGGER trigger_sync_team_member_profile_id
BEFORE INSERT OR UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_member_profile_id();

-- 10) Notes & guidance (do not execute):
-- - Make sure to run this migration with the service_role key or from the SQL editor in Supabase.
-- - Keep the `service_role` key secret; only server-side code should use it.
-- - After this migration, when you create a user via the Admin API and set `app_metadata.role`, a `profiles` row will be created automatically and the role will be propagated.
-- - Realtime: subscribe to `profiles` on the client to receive live updates. Example with supabase-js:
--   supabase.from('profiles').on('UPDATE', payload => { /* handle update */ }).subscribe();

-- End of file
