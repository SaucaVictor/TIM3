-- Migration: Create space_teams table and ensure status allows not_paid

CREATE TABLE IF NOT EXISTS public.space_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_age INTEGER,
  max_age INTEGER,
  member_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.space_teams ENABLE ROW LEVEL SECURITY;

-- Space members can view teams in their space
DROP POLICY IF EXISTS "Members can view space teams" ON public.space_teams;
CREATE POLICY "Members can view space teams" ON public.space_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.space_members 
      WHERE space_members.space_id = space_teams.space_id 
        AND space_members.user_id = auth.uid()
    )
  );

-- Space owners can manage teams in their space
DROP POLICY IF EXISTS "Owners can manage space teams" ON public.space_teams;
CREATE POLICY "Owners can manage space teams" ON public.space_teams
  FOR ALL USING (
    public.is_space_owner(space_id, auth.uid())
  );
