-- Migration: Add co-owner role and permissions

-- 1. Drop existing CHECK constraint on space_members.role and allow 'co-owner'
ALTER TABLE public.space_members DROP CONSTRAINT IF EXISTS space_members_role_check;
ALTER TABLE public.space_members ADD CONSTRAINT space_members_role_check CHECK (role IN ('owner', 'co-owner', 'member'));

-- 2. Update is_space_owner function to treat co-owners as space managers
CREATE OR REPLACE FUNCTION public.is_space_owner(p_space_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = p_user_id AND role IN ('owner', 'co-owner')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Dedicated primary owner check function (only role = 'owner' can delete the space)
CREATE OR REPLACE FUNCTION public.is_primary_space_owner(p_space_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = p_user_id AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Recreate spaces DELETE policy to restrict space deletion strictly to primary owners
DROP POLICY IF EXISTS "Owners can delete their space" ON public.spaces;
CREATE POLICY "Owners can delete their space" ON public.spaces
  FOR DELETE USING (public.is_primary_space_owner(id, auth.uid()));
