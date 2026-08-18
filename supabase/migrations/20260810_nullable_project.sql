-- Allow null project_id on time entries (project is now optional)
ALTER TABLE public.time_entries ALTER COLUMN project_id DROP NOT NULL;
