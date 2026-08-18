import {
  generateEntriesCsv,
  downloadFile,
  calculateDurationMinutes,
  formatDurationMinutes,
  formatDateShort,
  formatTimeHHMM,
} from '@/lib/utils';
import { calculateEntryEarnings } from '@/lib/billing';
import type { TimeEntry, AggregateProjectSummary, AggregateMemberSummary } from '@/types';

export function useExportCsv() {
  function exportEntriesToCsv(entries: TimeEntry[], spaceName: string) {
    if (!entries || entries.length === 0) return;

    const formattedRows = entries.map((entry) => {
      const startedAt = entry.started_at;
      const endedAt = entry.ended_at;
      const dateStr = entry.started_at ? entry.started_at.split('T')[0] : '';
      const memberName = entry.profiles?.full_name || 'Unknown Member';
      const memberEmail = entry.profiles?.email || '';
      const projectName = entry.projects?.name || 'Unassigned Project';
      const taskName = entry.tasks?.name || '';
      const startTimeStr = formatTimeHHMM(startedAt);
      const endTimeStr = endedAt ? formatTimeHHMM(endedAt) : '';
      const durationMin = Math.round(calculateDurationMinutes(startedAt, endedAt));
      const durationFormatted = formatDurationMinutes(durationMin);
      const status = entry.status || 'awaiting';
      const { earnings, hourlyRate } = calculateEntryEarnings(entry, entry.projects, entry.profiles);
      const currency = entry.projects?.billing_rules?.[0]?.currency || '€';
      const notes = entry.notes || '';

      return {
        date: dateStr,
        member: memberName,
        memberEmail,
        project: projectName,
        task: taskName,
        startTime: startTimeStr,
        endTime: endTimeStr,
        durationFormatted,
        durationMinutes: durationMin,
        status,
        hourlyRate: hourlyRate.toFixed(2),
        earnings: earnings.toFixed(2),
        currency,
        notes,
      };
    });

    const csvContent = generateEntriesCsv(formattedRows);
    const dateSlug = new Date().toISOString().split('T')[0];
    const filename = `TIM3_${spaceName.replace(/[^a-z0-9]/gi, '_')}_${dateSlug}.csv`;
    downloadFile(filename, csvContent);
  }

  function calculateProjectSummaries(entries: TimeEntry[]): AggregateProjectSummary[] {
    const map = new Map<string, { projectName: string; minutes: number }>();

    entries.forEach((e) => {
      const projId = e.project_id || 'unassigned';
      const projName = e.projects?.name || 'Unassigned';
      const mins = calculateDurationMinutes(e.started_at, e.ended_at);

      if (!map.has(projId)) {
        map.set(projId, { projectName: projName, minutes: 0 });
      }
      map.get(projId)!.minutes += mins;
    });

    return Array.from(map.entries()).map(([id, val]) => ({
      projectId: id,
      projectName: val.projectName,
      totalMinutes: val.minutes,
    }));
  }

  function calculateMemberSummaries(entries: TimeEntry[]): AggregateMemberSummary[] {
    const map = new Map<
      string,
      { userName: string; userEmail: string; avatarUrl: string | null; minutes: number }
    >();

    entries.forEach((e) => {
      const userId = e.user_id;
      const userName = e.profiles?.full_name || 'Member';
      const userEmail = e.profiles?.email || '';
      const avatarUrl = e.profiles?.avatar_url || null;
      const mins = calculateDurationMinutes(e.started_at, e.ended_at);

      if (!map.has(userId)) {
        map.set(userId, { userName, userEmail, avatarUrl, minutes: 0 });
      }
      map.get(userId)!.minutes += mins;
    });

    return Array.from(map.entries()).map(([id, val]) => ({
      userId: id,
      userName: val.userName,
      userEmail: val.userEmail,
      avatarUrl: val.avatarUrl,
      totalMinutes: val.minutes,
    }));
  }

  return {
    exportEntriesToCsv,
    calculateProjectSummaries,
    calculateMemberSummaries,
  };
}
