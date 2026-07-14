-- Google Drive Integration Schema for Netgain Operating Portal

-- Ensure company_settings has storage column
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS storage jsonb DEFAULT '{}'::jsonb;

-- Ensure google_connections user_id column type and constraints are updated if table exists
ALTER TABLE public.google_connections DROP CONSTRAINT IF EXISTS google_connections_user_id_fkey;
DROP POLICY IF EXISTS "Users manage own Google connection" ON public.google_connections;
ALTER TABLE public.google_connections ALTER COLUMN user_id TYPE TEXT;

-- Ensure project_drive_mapping linked_by column type and constraints are updated if table exists
ALTER TABLE public.project_drive_mapping DROP CONSTRAINT IF EXISTS project_drive_mapping_linked_by_fkey;
ALTER TABLE public.project_drive_mapping ALTER COLUMN linked_by TYPE TEXT;

-- 1. Google Connections Table (Encrypted Tokens)
CREATE TABLE IF NOT EXISTS public.google_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Can be auth.users UUID or client_accounts ID
    google_user_id TEXT,
    google_email TEXT,
    refresh_token TEXT NOT NULL,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'connected',
    storage_used BIGINT,
    storage_total BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id)
);

-- 2. Project Google Drive Workspace Mapping Table
CREATE TABLE IF NOT EXISTS public.project_drive_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL,
    folder_name TEXT,
    owner_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    linked_by TEXT,
    UNIQUE(project_id)
);

-- 3. Google Files Metadata cache (no file contents stored)
CREATE TABLE IF NOT EXISTS public.google_files_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id TEXT NOT NULL UNIQUE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT,
    web_view_link TEXT,
    web_content_link TEXT,
    parent_id TEXT,
    favorite BOOLEAN DEFAULT FALSE,
    created_time TIMESTAMP WITH TIME ZONE,
    modified_time TIMESTAMP WITH TIME ZONE,
    owner_name TEXT,
    owner_email TEXT,
    provider_status TEXT DEFAULT 'active', -- active, deleted, archived
    is_folder BOOLEAN DEFAULT FALSE,
    local_version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Google Drive Permissions cache
CREATE TABLE IF NOT EXISTS public.google_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    email_address TEXT,
    role TEXT, -- owner, writer, commenter, reader (matches Google api)
    type TEXT, -- user, group, domain, anyone
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(file_id, permission_id)
);

-- 5. Google Drive Activities Log Table
CREATE TABLE IF NOT EXISTS public.google_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    file_id TEXT,
    file_name TEXT,
    action TEXT NOT NULL, -- uploaded, downloaded, viewed, previewed, renamed, moved, deleted, shared, permission_changed, folder_created, folder_renamed, folder_deleted
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ── ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────────

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_drive_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_files_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_activity_logs ENABLE ROW LEVEL SECURITY;

-- Connection policy: Users can only see/modify their own connections
CREATE POLICY "Users manage own Google connection" ON public.google_connections
    FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

-- Workspace tables policies: Full access for all authenticated users for seamless ERP operation
CREATE POLICY "Full access to project drive mapping" ON public.project_drive_mapping FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Full access to google files metadata" ON public.google_files_metadata FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Full access to google permissions" ON public.google_permissions FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Full access to google activity logs" ON public.google_activity_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ── REALTIME CONFIGURATION ─────────────────────────────────────────────────────

ALTER TABLE public.google_connections REPLICA IDENTITY FULL;
ALTER TABLE public.project_drive_mapping REPLICA IDENTITY FULL;
ALTER TABLE public.google_files_metadata REPLICA IDENTITY FULL;
ALTER TABLE public.google_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.google_activity_logs REPLICA IDENTITY FULL;

-- Add to Realtime Publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'google_connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE google_connections;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'project_drive_mapping'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_drive_mapping;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'google_files_metadata'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE google_files_metadata;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'google_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE google_permissions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'google_activity_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE google_activity_logs;
  END IF;
END
$$;
