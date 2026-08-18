-- Migration: Add DOB to profiles and billing_rules to projects

-- 1. Add dob column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dob DATE;

-- 2. Add billing_rules jsonb column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS billing_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Ensure RLS allows profiles update for own row
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
