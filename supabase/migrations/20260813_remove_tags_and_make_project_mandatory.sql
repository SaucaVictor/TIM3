-- Migration: Remove Tags from Notes & Enforce Mandatory Project ID
-- Date: 2026-08-13

-- 1. Clean existing notes: Strip tag bracket prefixes [Tag1] [Tag2] from time entries notes
UPDATE public.time_entries 
SET notes = BTRIM(REGEXP_REPLACE(notes, '^(\[[^\]]+\]\s*)+', '')) 
WHERE notes LIKE '[%';

-- 2. Ensure all time entries have a valid project_id before setting NOT NULL
DO $$
DECLARE
  r RECORD;
  default_proj_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT space_id FROM public.time_entries WHERE project_id IS NULL LOOP
    -- Try to get an existing project in the space
    SELECT id INTO default_proj_id FROM public.projects WHERE space_id = r.space_id LIMIT 1;
    
    -- If no project exists in the space, create a default project
    IF default_proj_id IS NULL THEN
      INSERT INTO public.projects (space_id, name) 
      VALUES (r.space_id, 'Default Project') 
      RETURNING id INTO default_proj_id;
    END IF;

    -- Assign project_id to orphaned time entries
    UPDATE public.time_entries 
    SET project_id = default_proj_id 
    WHERE space_id = r.space_id AND project_id IS NULL;
  END LOOP;
END $$;

-- 3. Set project_id as NOT NULL
ALTER TABLE public.time_entries ALTER COLUMN project_id SET NOT NULL;
