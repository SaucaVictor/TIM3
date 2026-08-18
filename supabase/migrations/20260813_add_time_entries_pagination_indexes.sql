-- Migration: Add composite indexes for paginated time_entries queries
CREATE INDEX IF NOT EXISTS idx_time_entries_space_user_started 
ON public.time_entries (space_id, user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_space_started 
ON public.time_entries (space_id, started_at DESC);
