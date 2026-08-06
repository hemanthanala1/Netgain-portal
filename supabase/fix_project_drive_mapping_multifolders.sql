-- Fix project_drive_mapping table to support multiple linked Google Drive folders per project

-- 1. Drop existing single-project unique constraint if present
ALTER TABLE public.project_drive_mapping DROP CONSTRAINT IF EXISTS project_drive_mapping_project_id_key;

-- 2. Add composite unique constraint for (project_id, folder_id)
ALTER TABLE public.project_drive_mapping DROP CONSTRAINT IF EXISTS project_drive_mapping_project_folder_key;
ALTER TABLE public.project_drive_mapping ADD CONSTRAINT project_drive_mapping_project_folder_key UNIQUE (project_id, folder_id);
