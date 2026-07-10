-- SQL Migration for Project Workspace Extras (Risks, Dependencies, Notes, Approvals)

-- 1. Project Risks Table
CREATE TABLE IF NOT EXISTS public.project_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    impact TEXT DEFAULT 'Medium', -- Low, Medium, High
    probability TEXT DEFAULT 'Medium', -- Low, Medium, High
    status TEXT DEFAULT 'Identified', -- Identified, Mitigated, Occurred
    mitigation TEXT,
    visibility TEXT DEFAULT 'Internal Only', -- Internal Only, Published to Client
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Project Dependencies Table
CREATE TABLE IF NOT EXISTS public.project_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    dependent_on TEXT NOT NULL, -- What is this project dependent on?
    description TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Resolved, Blocked
    visibility TEXT DEFAULT 'Internal Only',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Project Notes Table
CREATE TABLE IF NOT EXISTS public.project_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    visibility TEXT DEFAULT 'Internal Only',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Project Approvals Table
CREATE TABLE IF NOT EXISTS public.project_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Approved, Rejected
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT
);

-- ── ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────────

ALTER TABLE public.project_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Full Access Project Risks" ON public.project_risks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Dependencies" ON public.project_dependencies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Notes" ON public.project_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Full Access Project Approvals" ON public.project_approvals FOR ALL USING (true) WITH CHECK (true);

-- ── ENABLE REALTIME REPLICATION ──────────────────────────────────────────

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES 
        ('project_risks'), 
        ('project_dependencies'), 
        ('project_notes'), 
        ('project_approvals')
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
