-- TIM3 Database Schema & RLS Policies Migration

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. SPACES TABLE
CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.space_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(space_id, user_id)
);

-- 4. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TIME ENTRIES TABLE
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ, -- NULL while active
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- DATABASE GUARANTEE: Max 1 active timer per user per space
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_timer_per_user_space 
ON public.time_entries (space_id, user_id) 
WHERE ended_at IS NULL;

-- AUTOMATIC PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC FUNCTION: CREATE SPACE WITH OWNER
CREATE OR REPLACE FUNCTION public.create_space_with_owner(space_name TEXT, code TEXT)
RETURNS UUID AS $$
DECLARE
  new_space_id UUID;
BEGIN
  INSERT INTO public.spaces (name, join_code, owner_id)
  VALUES (space_name, UPPER(code), auth.uid())
  RETURNING id INTO new_space_id;

  INSERT INTO public.space_members (space_id, user_id, role)
  VALUES (new_space_id, auth.uid(), 'owner');

  RETURN new_space_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC FUNCTION: JOIN SPACE BY CODE
CREATE OR REPLACE FUNCTION public.join_space_by_code(code TEXT)
RETURNS UUID AS $$
DECLARE
  target_space_id UUID;
BEGIN
  SELECT id INTO target_space_id FROM public.spaces WHERE join_code = UPPER(code);
  IF target_space_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or nonexistent space code';
  END IF;

  IF EXISTS (SELECT 1 FROM public.space_members WHERE space_id = target_space_id AND user_id = auth.uid()) THEN
    RETURN target_space_id;
  END IF;

  INSERT INTO public.space_members (space_id, user_id, role)
  VALUES (target_space_id, auth.uid(), 'member');

  RETURN target_space_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_space_member(p_space_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_space_owner(p_space_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = p_user_id AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "View space member profiles" ON public.profiles;
CREATE POLICY "View space member profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.space_members m1
      JOIN public.space_members m2 ON m1.space_id = m2.space_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Spaces Policies
DROP POLICY IF EXISTS "Members can view their spaces" ON public.spaces;
CREATE POLICY "Members can view their spaces" ON public.spaces
  FOR SELECT USING (public.is_space_member(id, auth.uid()));

DROP POLICY IF EXISTS "Owners can update their space" ON public.spaces;
CREATE POLICY "Owners can update their space" ON public.spaces
  FOR UPDATE USING (public.is_space_owner(id, auth.uid()));

-- Space Members Policies
DROP POLICY IF EXISTS "Members can view space member list" ON public.space_members;
CREATE POLICY "Members can view space member list" ON public.space_members
  FOR SELECT USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage space members" ON public.space_members;
CREATE POLICY "Owners can manage space members" ON public.space_members
  FOR ALL USING (public.is_space_owner(space_id, auth.uid()));

-- Projects Policies
DROP POLICY IF EXISTS "Members can view projects" ON public.projects;
CREATE POLICY "Members can view projects" ON public.projects
  FOR SELECT USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage projects" ON public.projects;
CREATE POLICY "Owners can manage projects" ON public.projects
  FOR ALL USING (public.is_space_owner(space_id, auth.uid()));

-- Tasks Policies
DROP POLICY IF EXISTS "Members can view tasks" ON public.tasks;
CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT USING (public.is_space_member(space_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage tasks" ON public.tasks;
CREATE POLICY "Owners can manage tasks" ON public.tasks
  FOR ALL USING (public.is_space_owner(space_id, auth.uid()));

-- Time Entries Policies
DROP POLICY IF EXISTS "View time entries" ON public.time_entries;
CREATE POLICY "View time entries" ON public.time_entries
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_space_owner(space_id, auth.uid())
  );

DROP POLICY IF EXISTS "Insert own time entries" ON public.time_entries;
CREATE POLICY "Insert own time entries" ON public.time_entries
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND public.is_space_member(space_id, auth.uid())
  );

DROP POLICY IF EXISTS "Update own time entries" ON public.time_entries;
CREATE POLICY "Update own time entries" ON public.time_entries
  FOR UPDATE USING (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Delete own time entries" ON public.time_entries;
CREATE POLICY "Delete own time entries" ON public.time_entries
  FOR DELETE USING (
    user_id = auth.uid()
  );
