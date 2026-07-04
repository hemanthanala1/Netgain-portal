-- SQL Migration to support Complete Project Workspace System

-- 1. Project Requirements Table
CREATE TABLE IF NOT EXISTS public.project_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT, -- e.g. Logo, Fonts, Competitors, Hosting
    priority TEXT DEFAULT 'medium', -- low, medium, high
    due_date DATE,
    allow_file BOOLEAN DEFAULT TRUE,
    allow_link BOOLEAN DEFAULT FALSE,
    allow_text BOOLEAN DEFAULT TRUE,
    allow_multiple BOOLEAN DEFAULT FALSE,
    is_required BOOLEAN DEFAULT TRUE,
    status TEXT DEFAULT 'pending', -- pending, submitted, approved, needs revision, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Project Requirement Submissions Table (stores submission history and details)
CREATE TABLE IF NOT EXISTS public.project_requirement_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id UUID NOT NULL REFERENCES public.project_requirements(id) ON DELETE CASCADE,
    text_response TEXT,
    links TEXT[] DEFAULT '{}'::TEXT[],
    file_paths TEXT[] DEFAULT '{}'::TEXT[],
    notes TEXT,
    submitted_by TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    feedback TEXT,
    feedback_by TEXT,
    feedback_at TIMESTAMP WITH TIME ZONE,
    history JSONB DEFAULT '[]'::JSONB -- stores previous versions for review audit trail
);

-- 3. Project Files Table
CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Supabase storage path or public url
    category TEXT NOT NULL, -- e.g. Proposal, Quotation, SOW, Agreement, Invoice, Reports, Design, Code, Manuals, Other
    version INTEGER DEFAULT 1,
    visibility TEXT DEFAULT 'Internal Only', -- Internal Only, Published to Client, Hidden
    uploaded_by TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Project Links Table
CREATE TABLE IF NOT EXISTS public.project_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT, -- e.g. Live Website, Staging, Figma, Canva, Drive, Github, Hosting, Ads, Analytics
    description TEXT,
    url TEXT NOT NULL,
    visibility TEXT DEFAULT 'Published to Client', -- Internal Only, Published to Client, Hidden
    published_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. Project Reports Table
CREATE TABLE IF NOT EXISTS public.project_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    report_type TEXT NOT NULL, -- Marketing Report, SEO, Google Ads, Meta Ads, Analytics, Performance, Custom
    file_path TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    visibility TEXT DEFAULT 'Published to Client', -- Internal Only, Published to Client, Hidden
    uploaded_by TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. Project Activity Timeline Table
CREATE TABLE IF NOT EXISTS public.project_activity_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ── ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────────

ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirement_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_timeline ENABLE ROW LEVEL SECURITY;

-- Define Policies: Allow all access for authenticated and anonymous users for easy setup
CREATE POLICY "Public Full Access Project Requirements" ON public.project_requirements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Requirement Submissions" ON public.project_requirement_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Files" ON public.project_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Links" ON public.project_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Reports" ON public.project_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Activity Timeline" ON public.project_activity_timeline FOR ALL USING (true) WITH CHECK (true);

-- ── ENABLE REALTIME REPLICATION ──────────────────────────────────────────
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
      VALUES 
        ('project_requirements'), 
        ('project_requirement_submissions'), 
        ('project_files'), 
        ('project_links'), 
        ('project_reports'), 
        ('project_activity_timeline')
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
