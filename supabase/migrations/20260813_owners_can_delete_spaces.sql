-- Migration to allow space owners to delete their spaces
DROP POLICY IF EXISTS "Owners can delete their space" ON public.spaces;
CREATE POLICY "Owners can delete their space" ON public.spaces
  FOR DELETE USING (public.is_space_owner(id, auth.uid()));
