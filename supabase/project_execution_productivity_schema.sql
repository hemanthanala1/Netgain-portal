-- SQL Migration for Project Execution & Productivity Tracking System (Fully Idempotent)

-- 1. Project Milestones Table
CREATE TABLE IF NOT EXISTS public.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, In Progress, Completed, Blocked, Paused, Cancelled
    order_index INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Project Tasks Table
CREATE TABLE IF NOT EXISTS public.project_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT NOT NULL, -- e.g. "Rahul"
    assigned_employee_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL,
    due_date DATE,
    priority TEXT DEFAULT 'Medium', -- Low, Medium, High, Urgent
    estimated_hours NUMERIC DEFAULT 0,
    logged_hours NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending', -- Pending (0%), In Progress (30%), Review (90%), Completed (100%), Blocked, Paused, Cancelled
    progress NUMERIC DEFAULT 0, -- 0 - 100
    external_integration_id TEXT, -- Future ready: GitHub, GitLab, Jira
    metadata JSONB DEFAULT '{}'::JSONB, -- Future ready: commits, PR links, branch names, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Project Work Logs Table (Deliverables & Progress based submission)
CREATE TABLE IF NOT EXISTS public.project_work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    employee_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL,
    employee_name TEXT NOT NULL,
    work_completed TEXT NOT NULL, -- Detailed notes of work finished
    progress_before NUMERIC DEFAULT 0,
    progress_after NUMERIC DEFAULT 0,
    hours_spent NUMERIC DEFAULT 0,
    hourly_rate NUMERIC DEFAULT 500, -- Hourly internal cost of employee
    calculated_cost NUMERIC DEFAULT 0, -- hours_spent * hourly_rate
    files_modified TEXT[] DEFAULT '{}'::TEXT[], -- e.g. Invoice.tsx, InvoiceTable.tsx
    blockers TEXT,
    attachments JSONB DEFAULT '[]'::JSONB, -- Array of { name, url, type }
    status TEXT DEFAULT 'Pending', -- Pending, Approved, Changes Requested, Rejected
    reviewer_feedback TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::JSONB, -- Future ready for commit tracking, AI summary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Project Activity Timeline Table
CREATE TABLE IF NOT EXISTS public.project_activity_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL, -- e.g. Task Assigned, Work Log Submitted, Admin Approved, Progress Updated, Attachment Uploaded
    notes TEXT,
    timestamp_text TEXT, -- e.g. "09:20", "10:45"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Project Announcements Table
CREATE TABLE IF NOT EXISTS public.project_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    visibility TEXT DEFAULT 'Published to Client', -- Published to Client, Internal Only
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Project Notifications Table
CREATE TABLE IF NOT EXISTS public.project_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_role TEXT NOT NULL, -- employee, manager, founder
    recipient_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- task_assigned, due_soon, work_log_submitted, work_log_approved, work_log_rejected, project_delayed, budget_exceeded
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
    work_log_id UUID REFERENCES public.project_work_logs(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add hourly_rate column to team_members if not present
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 500;

-- ── ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────────
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Full Access Project Milestones" ON public.project_milestones;
CREATE POLICY "Public Full Access Project Milestones" ON public.project_milestones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Project Tasks" ON public.project_tasks;
CREATE POLICY "Public Full Access Project Tasks" ON public.project_tasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Project Work Logs" ON public.project_work_logs;
CREATE POLICY "Public Full Access Project Work Logs" ON public.project_work_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Project Activity Timeline" ON public.project_activity_timeline;
CREATE POLICY "Public Full Access Project Activity Timeline" ON public.project_activity_timeline FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Project Announcements" ON public.project_announcements;
CREATE POLICY "Public Full Access Project Announcements" ON public.project_announcements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Full Access Project Notifications" ON public.project_notifications;
CREATE POLICY "Public Full Access Project Notifications" ON public.project_notifications FOR ALL USING (true) WITH CHECK (true);

-- ── ENABLE REALTIME REPLICATION ──────────────────────────────────────────
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES 
        ('project_milestones'), 
        ('project_tasks'), 
        ('project_work_logs'), 
        ('project_activity_timeline'), 
        ('project_announcements'),
        ('project_notifications')
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
