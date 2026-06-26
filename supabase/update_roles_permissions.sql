-- SQL Migration to update seed roles permissions with new modules (meetings, communications, services, prd)

-- Update Admin permissions (full access except settings)
UPDATE public.custom_roles
SET permissions = ARRAY['crm', 'services', 'documents', 'projects', 'prd', 'marketing', 'finance', 'meetings', 'communications', 'team']
WHERE name = 'Admin';

-- Update Project Manager permissions
UPDATE public.custom_roles
SET permissions = ARRAY['crm', 'services', 'documents', 'projects', 'prd', 'meetings', 'communications']
WHERE name = 'Project Manager';

-- Update Sales Executive permissions
UPDATE public.custom_roles
SET permissions = ARRAY['crm', 'meetings', 'communications', 'marketing']
WHERE name = 'Sales Executive';

-- Update Employee permissions
UPDATE public.custom_roles
SET permissions = ARRAY['projects', 'prd', 'meetings']
WHERE name = 'Employee';
