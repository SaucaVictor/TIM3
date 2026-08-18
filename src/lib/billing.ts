import type { Profile, Project, ProjectBillingRule, TimeEntry } from '@/types';

/**
 * Calculates user's age in full years from their date of birth (DOB: YYYY-MM-DD)
 * @param dob Date of birth string (YYYY-MM-DD)
 * @param atDate Optional comparison date (defaults to current date)
 */
export function calculateAge(dob: string | null | undefined, atDate: Date | string = new Date()): number | null {
  if (!dob) return null;

  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;

  const targetDate = typeof atDate === 'string' ? new Date(atDate) : atDate;
  if (isNaN(targetDate.getTime())) return null;

  let age = targetDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = targetDate.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && targetDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : 0;
}

/**
 * Formats a Date of Birth string into a readable format (e.g. "15 May 2002")
 */
export function formatDob(dob: string | null | undefined): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Checks if a given age satisfies a billing rule condition
 */
export function matchesAgeRule(age: number, rule: ProjectBillingRule): boolean {
  const threshold = rule.age_threshold;
  switch (rule.age_operator) {
    case '<':
      return age < threshold;
    case '<=':
      return age <= threshold;
    case '>':
      return age > threshold;
    case '>=':
      return age >= threshold;
    case '==':
      return age === threshold;
    case '!=':
      return age !== threshold;
    default:
      return false;
  }
}

/**
 * Resolves the applicable billing rule and hourly rate for a user on a project
 */
export function getProjectBillingRate(
  project?: Project | null,
  profile?: Profile | null,
  entryDate?: string
): { rate: number; ruleTitle: string | null; rule: ProjectBillingRule | null } {
  if (!project || !project.billing_rules || project.billing_rules.length === 0) {
    return { rate: 0, ruleTitle: null, rule: null };
  }

  const age = calculateAge(profile?.dob, entryDate ? new Date(entryDate) : new Date());
  if (age === null) {
    // If no DOB is set, return default / 0 rate
    return { rate: 0, ruleTitle: null, rule: null };
  }

  // Find the first rule that matches the user's age
  for (const rule of project.billing_rules) {
    if (matchesAgeRule(age, rule)) {
      return {
        rate: Number(rule.hourly_rate) || 0,
        ruleTitle: rule.title,
        rule,
      };
    }
  }

  return { rate: 0, ruleTitle: null, rule: null };
}

/**
 * Calculates earnings for a given time entry based on duration and matching project billing rule
 */
export function calculateEntryEarnings(
  entry: TimeEntry,
  project?: Project | null,
  profile?: Profile | null
): { earnings: number; hourlyRate: number; ruleTitle: string | null; durationMinutes: number } {
  const proj = project || entry.projects;
  const prof = profile || entry.profiles;

  let durationSec = 0;
  if (entry.started_at && entry.ended_at) {
    durationSec = Math.max(0, Math.round((new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 1000));
  }
  const durationMinutes = Math.floor(durationSec / 60);
  const durationHours = durationSec / 3600;

  const { rate, ruleTitle } = getProjectBillingRate(proj, prof, entry.started_at);
  const earnings = durationHours * rate;

  return {
    earnings: Math.round(earnings * 100) / 100,
    hourlyRate: rate,
    ruleTitle,
    durationMinutes,
  };
}
