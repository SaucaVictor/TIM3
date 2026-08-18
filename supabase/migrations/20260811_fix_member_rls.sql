-- Fix RLS: allow all space members to insert/update projects and tasks
-- Also fix time_entries SELECT so all members can read space entries (needed for tag scanning and team context)

-- PROJECTS: members can insert, members can update their own space's projects
DROP POLICY IF EXISTS "Members can insert projects" ON public.projects;
CREATE POLICY "Members can insert projects" ON public.projects
  FOR INSERT WITH CHECK (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "Members can update projects" ON public.projects;
CREATE POLICY "Members can update projects" ON public.projects
  FOR UPDATE USING (public.is_space_member(space_id, auth.uid()));

-- Keep: only owners can delete projects (too destructive for regular members)
-- "Owners can manage projects" still covers DELETE via FOR ALL

-- TASKS: members can insert and update tasks in their space
DROP POLICY IF EXISTS "Members can insert tasks" ON public.tasks;
CREATE POLICY "Members can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "Members can update tasks" ON public.tasks;
CREATE POLICY "Members can update tasks" ON public.tasks
  FOR UPDATE USING (public.is_space_member(space_id, auth.uid()));

-- TIME ENTRIES: all space members can view all entries in their space (for tags, history, context)
DROP POLICY IF EXISTS "View time entries" ON public.time_entries;
CREATE POLICY "View time entries" ON public.time_entries
  FOR SELECT USING (public.is_space_member(space_id, auth.uid()));

-- TIME ENTRIES: owner can also update any entry (for status changes), keep own entry update for members
DROP POLICY IF EXISTS "Update own time entries" ON public.time_entries;
CREATE POLICY "Update own time entries" ON public.time_entries
  FOR UPDATE USING (
    user_id = auth.uid() OR public.is_space_owner(space_id, auth.uid())
  );
