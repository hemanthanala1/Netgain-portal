-- Migration to add assignee_id to projects and related workspace tables

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS assignee_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.project_risks 
ADD COLUMN IF NOT EXISTS assignee_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.project_dependencies 
ADD COLUMN IF NOT EXISTS assignee_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL;

ALTER TABLE public.project_notes 
ADD COLUMN IF NOT EXISTS assignee_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL;
