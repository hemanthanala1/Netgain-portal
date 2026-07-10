-- Create the project_timesheets table
CREATE TABLE IF NOT EXISTS public.project_timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    team_member_id TEXT REFERENCES public.team_members(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    billable BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.project_timesheets ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view all timesheets
CREATE POLICY "Enable read access for authenticated users" 
    ON public.project_timesheets FOR SELECT 
    TO authenticated 
    USING (true);

-- Create policy for authenticated users to insert timesheets
CREATE POLICY "Enable insert access for authenticated users" 
    ON public.project_timesheets FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Create policy for authenticated users to update timesheets
CREATE POLICY "Enable update access for authenticated users" 
    ON public.project_timesheets FOR UPDATE
    TO authenticated 
    USING (true);

-- Create policy for authenticated users to delete timesheets
CREATE POLICY "Enable delete access for authenticated users" 
    ON public.project_timesheets FOR DELETE
    TO authenticated 
    USING (true);

-- Setup realtime broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_timesheets;
