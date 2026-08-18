export type Role = 'owner' | 'co-owner' | 'member';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  dob?: string | null; // YYYY-MM-DD
  created_at: string;
}

export interface Space {
  id: string;
  name: string;
  join_code: string;
  owner_id: string;
  created_at: string;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  profiles?: Profile;
}

export type EntryStatus = 'awaiting' | 'approved' | 'paid';

export type AgeOperator = '<' | '<=' | '>' | '>=' | '==' | '!=';

export interface ProjectBillingRule {
  id: string;
  title: string;
  age_operator: AgeOperator;
  age_threshold: number;
  hourly_rate: number;
  currency?: string;
}

export interface Project {
  id: string;
  space_id: string;
  name: string;
  responsible_user_id?: string | null;
  billing_rules?: ProjectBillingRule[];
  created_at: string;
  tasks?: Task[];
  responsible_profile?: Profile | null;
}

export interface Task {
  id: string;
  project_id: string;
  space_id: string;
  name: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  space_id: string;
  user_id: string;
  project_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  status?: EntryStatus;
  created_at: string;
  updated_at: string;
  // Joined properties
  projects?: Project;
  tasks?: Task | null;
  profiles?: Profile;
}

export interface AggregateProjectSummary {
  projectId: string;
  projectName: string;
  totalMinutes: number;
}

export interface AggregateMemberSummary {
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl: string | null;
  totalMinutes: number;
}
