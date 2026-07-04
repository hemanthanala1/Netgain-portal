-- Migration: Enable full realtime for all workspace and project tables
-- Run this in Supabase SQL Editor

ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.project_requirements REPLICA IDENTITY FULL;
ALTER TABLE public.project_requirement_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.project_files REPLICA IDENTITY FULL;
ALTER TABLE public.project_links REPLICA IDENTITY FULL;
ALTER TABLE public.project_reports REPLICA IDENTITY FULL;
ALTER TABLE public.project_activity_timeline REPLICA IDENTITY FULL;
ALTER TABLE public.client_notifications REPLICA IDENTITY FULL;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'projects',
    'project_requirements',
    'project_requirement_submissions',
    'project_files',
    'project_links',
    'project_reports',
    'project_activity_timeline',
    'client_notifications'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END
$$;
