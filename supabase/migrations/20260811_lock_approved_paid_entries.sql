-- Lock approved/paid entries: only owners can update or delete them
-- Regular members can only modify their own entries while status = 'awaiting'

DROP POLICY IF EXISTS "Update own time entries" ON public.time_entries;
CREATE POLICY "Update own time entries" ON public.time_entries
  FOR UPDATE USING (
    -- Owner can update any entry in their space
    public.is_space_owner(space_id, auth.uid())
    OR
    -- Member can only update their own awaiting entries
    (user_id = auth.uid() AND status = 'awaiting')
  );

DROP POLICY IF EXISTS "Delete own time entries" ON public.time_entries;
CREATE POLICY "Delete own time entries" ON public.time_entries
  FOR DELETE USING (
    -- Owner can delete any entry
    public.is_space_owner(space_id, auth.uid())
    OR
    -- Member can only delete their own awaiting entries
    (user_id = auth.uid() AND status = 'awaiting')
  );
