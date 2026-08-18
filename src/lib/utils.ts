/**
 * Format milliseconds into HH:MM:SS
 */
export function formatElapsedMs(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format duration in minutes into friendly string like "1h 30m" or "45m"
 */
export function formatDurationMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Calculate duration in total seconds between start and end timestamps
 */
export function calculateDurationSeconds(startedAt: string, endedAt?: string | null): number {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - start;
  return Math.max(0, Math.round(diffMs / 1000));
}

/**
 * Calculate duration in minutes between start and end timestamps (kept for backwards compat)
 */
export function calculateDurationMinutes(startedAt: string, endedAt?: string | null): number {
  return calculateDurationSeconds(startedAt, endedAt) / 60;
}

/**
 * Format timestamp into HH:MM (e.g. 09:30)
 */
export function formatTimeHHMM(isoString: string): string {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format timestamp into readable date string (e.g. Aug 10)
 */
export function formatDateShort(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format timestamp for HTML input datetime-local / time input
 */
export function formatInputTime(dateObj: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
}

/**
 * Generate short join code e.g. TIM3-X7K9
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous characters I, O, 0, 1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TIM3-${code}`;
}

/**
 * Generate CSV string from time entries
 */
export function generateEntriesCsv(
  entries: Array<{
    date: string;
    member: string;
    memberEmail: string;
    project: string;
    task: string;
    startTime: string;
    endTime: string;
    durationFormatted: string;
    durationMinutes: number;
    status: string;
    hourlyRate: number | string;
    earnings: number | string;
    currency: string;
    notes: string;
  }>
): string {
  const headers = [
    'date',
    'member',
    'member_email',
    'project',
    'task',
    'start_time',
    'end_time',
    'duration_formatted',
    'duration_minutes',
    'status',
    'hourly_rate',
    'earnings',
    'currency',
    'notes',
  ];
  
  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = entries.map((e) => [
    escapeCsv(e.date),
    escapeCsv(e.member),
    escapeCsv(e.memberEmail),
    escapeCsv(e.project),
    escapeCsv(e.task),
    escapeCsv(e.startTime),
    escapeCsv(e.endTime),
    escapeCsv(e.durationFormatted),
    e.durationMinutes,
    escapeCsv(e.status),
    e.hourlyRate,
    e.earnings,
    escapeCsv(e.currency),
    escapeCsv(e.notes),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Trigger client-side file download for CSV
 */
export function downloadFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
