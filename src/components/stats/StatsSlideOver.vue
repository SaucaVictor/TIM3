<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useProjects } from '@/composables/useProjects';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useSpace } from '@/composables/useSpace';
import { useSwipeGesture } from '@/composables/useSwipeGesture';
import { calculateEntryEarnings, getProjectBillingRate, calculateAge } from '@/lib/billing';
import type { Project, TimeEntry, EntryStatus, SpaceMember } from '@/types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Coins,
  CheckCircle2,
  CircleDollarSign,
  AlertCircle,
  Loader,
  Calendar,
  Folder,
  Tag,
  CheckSquare,
  Sparkles,
  BarChart3,
  Download,
} from 'lucide-vue-next';
import { useExportCsv } from '@/composables/useExportCsv';

interface Props {
  isOpen: boolean;
  userId?: string | null;
  member?: SpaceMember | null;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
  userId: null,
  member: null,
});

const emit = defineEmits(['close']);

const router = useRouter();
const route = useRoute();
const { profile } = useAuth();
const { currentSpace, spaceMembers, isOwner } = useSpace();
const { projects, fetchProjects } = useProjects();
const { userEntries, spaceTeamEntries, fetchUserEntries, fetchSpaceTeamEntries } = useTimeEntries();
const { exportEntriesToCsv } = useExportCsv();

const isMainPage = computed(() => {
  return route.path === '/' || route.name === 'timer' || !route.name || route.path === '';
});

function handleExportStatsCsv() {
  if (currentSpace.value && activeEntries.value.length > 0) {
    const memberName = targetDisplayName.value || profile.value?.full_name || 'user';
    const projectName = selectedProjectId.value ? currentProject.value?.name : null;
    const parts = [currentSpace.value.name, memberName, projectName].filter(Boolean);
    const spaceSlug = parts.join('_').replace(/[^a-z0-9]/gi, '_');
    exportEntriesToCsv(activeEntries.value, spaceSlug);
  }
}

const targetUserId = computed(() => {
  return props.userId || props.member?.user_id || profile.value?.id || null;
});

const isViewingOtherMember = computed(() => {
  return Boolean(targetUserId.value && profile.value?.id && targetUserId.value !== profile.value.id);
});

const targetMember = computed(() => {
  if (props.member) return props.member;
  if (targetUserId.value) {
    return spaceMembers.value.find((m) => m.user_id === targetUserId.value) || null;
  }
  return null;
});

const targetProfile = computed(() => {
  return targetMember.value?.profiles || (targetUserId.value === profile.value?.id ? profile.value : null);
});

const targetDisplayName = computed(() => {
  if (isViewingOtherMember.value) {
    return targetProfile.value?.full_name || targetProfile.value?.email || 'Member';
  }
  return '';
});

const sourceEntries = computed(() => {
  if (isViewingOtherMember.value) {
    return spaceTeamEntries.value.filter((e) => e.user_id === targetUserId.value);
  }
  return userEntries.value;
});

const mainPanelRef = ref<HTMLElement | null>(null);
const contentScrollRef = ref<HTMLElement | null>(null);

// Selected Project for Drilldown View
const selectedProjectId = ref<string | null>(null);

// Timeframe selector: '1W' | '1M' | '6M' | '1Y' | 'ALL'
type TimeFrame = '1W' | '1M' | '6M' | '1Y' | 'ALL';
const selectedTimeframe = ref<TimeFrame>('1M');

// Selected Bar on chart
const selectedBarIndex = ref<number | null>(null);

// Anchor date for period intervals
const anchorDate = ref<Date>(new Date());
const datePickerInput = ref<HTMLInputElement | null>(null);

// Reset bar selection on timeframe switch
watch(selectedTimeframe, () => {
  selectedBarIndex.value = null;
});

// Scroll to top when selectedProjectId changes or resets to null
watch(
  () => selectedProjectId.value,
  async () => {
    await nextTick();
    setTimeout(() => {
    if (contentScrollRef.value) {
      contentScrollRef.value.scrollTop = 0;
    }
    if (mainPanelRef.value) {
      mainPanelRef.value.scrollTop = 0;
    }
    }, 250);
  }
);

// Swipe gestures on panel
useSwipeGesture(mainPanelRef, {
  onSwipeRight: () => {
    if (props.isOpen) {
      if (selectedProjectId.value) {
        handleCloseSubSlide();
      } else {
        handleClose();
      }
    }
  },
});

const colorPalette = [
  '#5bb8f5',
  '#4caf50',
  '#a855f7',
  '#f43f5e',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#eab308',
  '#ef4444',
  '#6366f1',
  '#d946ef',
  '#f97316',
];

function getProjectColor(index: number): string {
  return colorPalette[index % colorPalette.length];
}

onMounted(async () => {
  if (currentSpace.value) {
    if (projects.value.length === 0) {
      await fetchProjects(currentSpace.value.id);
    }
    if (userEntries.value.length === 0) {
      await fetchUserEntries(currentSpace.value.id);
    }
  }
});

// Route & Query Synchronization + Scroll Lock
watch(
  () => props.isOpen,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      selectedProjectId.value = null;
      selectedBarIndex.value = null;
      selectedTimeframe.value = '1M';
      anchorDate.value = new Date();
      if (isViewingOtherMember.value) {
        if (route.query.memberStats !== targetUserId.value) {
          router.push({ query: { ...route.query, memberStats: targetUserId.value } });
        }
      } else if (route.path === '/' && route.query.stats !== 'open') {
        router.push({ query: { ...route.query, stats: 'open' } });
      }

      if (currentSpace.value) {
        if (projects.value.length === 0) {
          await fetchProjects(currentSpace.value.id);
        }
        if (isViewingOtherMember.value || isOwner.value) {
          await fetchSpaceTeamEntries(currentSpace.value.id, true);
        } else {
          await fetchUserEntries(currentSpace.value.id);
        }
      }
    } else {
      selectedProjectId.value = null;
      selectedBarIndex.value = null;
      selectedTimeframe.value = '1M';
      anchorDate.value = new Date();
    }
  },
  { immediate: true }
);

watch(
  () => selectedProjectId.value,
  (projId) => {
    if (projId) {
      if (route.query.statsProject !== projId) {
        router.push({ query: { ...route.query, statsProject: projId } });
      }
    } else {
      if (route.query.statsProject) {
        const query = { ...route.query };
        delete query.statsProject;
        router.replace({ query });
      }
    }
  }
);

// Watch browser back/forward buttons
watch(
  () => route.query,
  (newQuery) => {
    if (props.isOpen) {
      // Subslide check
      const targetProj = (newQuery.statsProject as string) || null;
      if (selectedProjectId.value !== targetProj) {
        selectedProjectId.value = targetProj;
      }

      // Main slider close check on back button
      if (isViewingOtherMember.value) {
        if (!newQuery.memberStats) {
          emit('close');
        }
      } else if (route.path === '/') {
        if (newQuery.stats !== 'open') {
          emit('close');
        }
      }
    }
  },
  { deep: true }
);

function handleClose() {
  selectedProjectId.value = null;
  selectedBarIndex.value = null;
  selectedTimeframe.value = '1M';
  anchorDate.value = new Date();
  emit('close');
  if (route.query.memberStats || route.query.stats || route.query.statsProject) {
    router.back();
  }
}

function handleCloseSubSlide() {
  selectedProjectId.value = null;
  if (route.query.statsProject) {
    router.back();
  }
}

// Current active project in drilldown mode
const currentProject = computed(() => {
  if (!selectedProjectId.value) return null;
  const fromProjects = projects.value.find((p) => p.id === selectedProjectId.value);
  if (fromProjects) return fromProjects;
  const fromTeam = spaceTeamEntries.value.find((e) => e.project_id === selectedProjectId.value)?.projects;
  if (fromTeam) return fromTeam as Project;
  return null;
});

// Helper functions for calendar interval calculation
function getStartOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getEndOfWeek(d: Date): Date {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

const currentInterval = computed(() => {
  const tf = selectedTimeframe.value;
  const d = anchorDate.value;

  if (tf === '1W') {
    const start = getStartOfWeek(d);
    const end = getEndOfWeek(d);
    const startMonth = start.toLocaleDateString(undefined, { month: 'short' });
    const endMonth = end.toLocaleDateString(undefined, { month: 'short' });
    const label = startMonth === endMonth
      ? `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`
      : `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
    return { start, end, label };
  }

  if (tf === '1M') {
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    return { start, end, label };
  }

  if (tf === '6M') {
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const start = new Date(d.getFullYear(), d.getMonth() - 5, 1, 0, 0, 0, 0);
    const label = `${start.toLocaleDateString(undefined, { month: 'short' })} - ${end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
    return { start, end, label };
  }

  if (tf === '1Y') {
    const start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
    const label = `${d.getFullYear()}`;
    return { start, end, label };
  }

  // ALL
  return {
    start: new Date(0),
    end: new Date(8640000000000000),
    label: 'All Time',
  };
});

function navigateInterval(direction: number) {
  const tf = selectedTimeframe.value;
  const next = new Date(anchorDate.value);

  if (tf === '1W') {
    next.setDate(next.getDate() + direction * 7);
  } else if (tf === '1M') {
    next.setMonth(next.getMonth() + direction);
  } else if (tf === '6M') {
    next.setMonth(next.getMonth() + direction * 6);
  } else if (tf === '1Y') {
    next.setFullYear(next.getFullYear() + direction);
  } else if (tf === 'ALL') {
    next.setFullYear(next.getFullYear() + direction);
  }

  anchorDate.value = next;
  selectedBarIndex.value = null;
}

function triggerDatePicker() {
  const el = datePickerInput.value;
  if (!el) return;
  if (typeof (el as any).showPicker === 'function') {
    (el as any).showPicker();
  } else {
    el.click();
  }
}

function handleDatePicked(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.value) {
    anchorDate.value = new Date(target.value + 'T12:00:00');
    selectedBarIndex.value = null;
  }
}

// Timeframe Filtering Logic bounded by interval
const filteredEntries = computed(() => {
  const { start, end } = currentInterval.value;
  const startTime = start.getTime();
  const endTime = end.getTime();

  return sourceEntries.value.filter((e) => {
    if (!e.started_at) return false;
    const t = new Date(e.started_at).getTime();
    if (t < startTime || t > endTime) return false;
    if (selectedProjectId.value && e.project_id !== selectedProjectId.value) return false;
    return true;
  });
});

// Check if entry belongs to a specific bar/column interval
function isEntryInBar(entry: TimeEntry, barIdx: number, tf: TimeFrame): boolean {
  if (!entry.started_at) return false;
  const d = new Date(entry.started_at);

  if (tf === '1W') {
    const start = getStartOfWeek(anchorDate.value);
    const targetDate = new Date(start);
    targetDate.setDate(start.getDate() + barIdx);
    return (
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate()
    );
  }

  if (tf === '1M') {
    const intervals = [
      { minDay: 1, maxDay: 7 },
      { minDay: 8, maxDay: 14 },
      { minDay: 15, maxDay: 21 },
      { minDay: 22, maxDay: 28 },
      { minDay: 29, maxDay: 31 },
    ];
    const target = intervals[barIdx];
    if (!target) return false;
    const day = d.getDate();
    return (
      d.getFullYear() === anchorDate.value.getFullYear() &&
      d.getMonth() === anchorDate.value.getMonth() &&
      day >= target.minDay &&
      day <= target.maxDay
    );
  }

  if (tf === '6M') {
    const targetDate = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() - (5 - barIdx), 1);
    return d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth();
  }

  if (tf === '1Y') {
    return d.getFullYear() === anchorDate.value.getFullYear() && d.getMonth() === barIdx;
  }

  // ALL
  return d.getMonth() === barIdx;
}

// Active entries (filtered by timeframe AND selected chart column if any)
const activeEntries = computed<TimeEntry[]>(() => {
  if (selectedBarIndex.value === null) {
    return filteredEntries.value;
  }
  return filteredEntries.value.filter((e) =>
    isEntryInBar(e, selectedBarIndex.value!, selectedTimeframe.value)
  );
});

// Primary Currency detected from project rules or default
const detectedCurrency = computed(() => {
  for (const p of projects.value) {
    if (p.billing_rules && p.billing_rules.length > 0) {
      for (const r of p.billing_rules) {
        if (r.currency) return r.currency;
      }
    }
  }
  return '€';
});

// Aggregations for Active View (All Projects or Drilldown Project)
const analyticsData = computed(() => {
  let totalMinutes = 0;
  let totalEarnings = 0;
  let paidEarnings = 0;
  let approvedEarnings = 0;
  let awaitingEarnings = 0;
  let notPaidEarnings = 0;

  let paidMinutes = 0;
  let approvedMinutes = 0;
  let awaitingMinutes = 0;
  let notPaidMinutes = 0;

  const projectMap = new Map<string, {
    project: Project;
    totalMinutes: number;
    totalEarnings: number;
    entriesCount: number;
    color: string;
  }>();

  const taskMap = new Map<string, {
    taskName: string;
    totalMinutes: number;
    totalEarnings: number;
    entriesCount: number;
    color: string;
  }>();

  // Initialize all projects when on main view
  if (!selectedProjectId.value) {
    projects.value.forEach((p, idx) => {
      projectMap.set(p.id, {
        project: p,
        totalMinutes: 0,
        totalEarnings: 0,
        entriesCount: 0,
        color: getProjectColor(idx),
      });
    });
  }

  activeEntries.value.forEach((entry) => {
    const proj = projects.value.find((p) => p.id === entry.project_id) || entry.projects;
    const { earnings, durationMinutes } = calculateEntryEarnings(entry, proj, targetProfile.value);

    totalMinutes += durationMinutes;
    totalEarnings += earnings;

    const status = (entry.status as EntryStatus) || 'awaiting';
    if (status === 'paid') {
      paidEarnings += earnings;
      paidMinutes += durationMinutes;
    } else if (status === 'approved') {
      approvedEarnings += earnings;
      approvedMinutes += durationMinutes;
    } else if (status === 'not_paid') {
      notPaidEarnings += earnings;
      notPaidMinutes += durationMinutes;
    } else {
      awaitingEarnings += earnings;
      awaitingMinutes += durationMinutes;
    }

    // Breakdown by project (main view)
    if (!selectedProjectId.value && entry.project_id) {
      let existing = projectMap.get(entry.project_id);
      if (!existing && proj) {
        existing = {
          project: proj,
          totalMinutes: 0,
          totalEarnings: 0,
          entriesCount: 0,
          color: getProjectColor(projectMap.size),
        };
        projectMap.set(entry.project_id, existing);
      }
      if (existing) {
        existing.totalMinutes += durationMinutes;
        existing.totalEarnings += earnings;
        existing.entriesCount += 1;
      }
    }

    // Breakdown by task (drilldown view)
    if (selectedProjectId.value) {
      const taskId = entry.task_id || 'none';
      const taskName = entry.tasks?.name || 'No task';
      let existing = taskMap.get(taskId);
      if (!existing) {
        existing = {
          taskName,
          totalMinutes: 0,
          totalEarnings: 0,
          entriesCount: 0,
          color: getProjectColor(taskMap.size),
        };
        taskMap.set(taskId, existing);
      }
      existing.totalMinutes += durationMinutes;
      existing.totalEarnings += earnings;
      existing.entriesCount += 1;
    }
  });

  const projectBreakdown = Array.from(projectMap.values())
    .filter((item) => item.totalMinutes > 0 || item.entriesCount > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const taskBreakdown = Array.from(taskMap.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const activeRateInfo = selectedProjectId.value
    ? getProjectBillingRate(currentProject.value, targetProfile.value)
    : null;

  return {
    totalMinutes,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    paidEarnings: Math.round(paidEarnings * 100) / 100,
    approvedEarnings: Math.round(approvedEarnings * 100) / 100,
    awaitingEarnings: Math.round(awaitingEarnings * 100) / 100,
    notPaidEarnings: Math.round(notPaidEarnings * 100) / 100,
    paidMinutes,
    approvedMinutes,
    awaitingMinutes,
    notPaidMinutes,
    projectBreakdown,
    taskBreakdown,
    activeRateInfo,
  };
});

// Format minutes to "Xh Ym"
function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Revolut-style Bar Chart generator (grouped into intervals based on timeframe)
interface BarItem {
  label: string;
  subLabel?: string;
  minutes: number;
  earnings: number;
  heightPercent: number; // 0 to 100
  isMax?: boolean;
}

const barChartData = computed<{ bars: BarItem[]; averageMinutes: number; averageEarnings: number }>(() => {
  const tf = selectedTimeframe.value;
  const entries = filteredEntries.value;

  if (tf === '1W') {
    // 7 exact days of the selected week (Mon to Sun) - No wrap-around!
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const start = getStartOfWeek(anchorDate.value);
    const dayBuckets = days.map((dayName, idx) => {
      const bDate = new Date(start);
      bDate.setDate(start.getDate() + idx);
      return {
        label: dayName,
        subLabel: String(bDate.getDate()),
        year: bDate.getFullYear(),
        month: bDate.getMonth(),
        date: bDate.getDate(),
        minutes: 0,
        earnings: 0,
      };
    });

    entries.forEach((e) => {
      if (!e.started_at) return;
      const d = new Date(e.started_at);
      const target = dayBuckets.find(
        (b) => b.year === d.getFullYear() && b.month === d.getMonth() && b.date === d.getDate()
      );
      if (target) {
        const { earnings, durationMinutes } = calculateEntryEarnings(
          e,
          projects.value.find((p) => p.id === e.project_id),
          targetProfile.value
        );
        target.minutes += durationMinutes;
        target.earnings += earnings;
      }
    });

    const maxMinutes = Math.max(1, ...dayBuckets.map((b) => b.minutes));
    const bars: BarItem[] = dayBuckets.map((b) => ({
      label: b.label,
      subLabel: b.subLabel,
      minutes: b.minutes,
      earnings: Math.round(b.earnings * 100) / 100,
      heightPercent: Math.round((b.minutes / maxMinutes) * 100),
      isMax: b.minutes === maxMinutes && b.minutes > 0,
    }));

    const totalMin = dayBuckets.reduce((acc, b) => acc + b.minutes, 0);
    const totalEarn = dayBuckets.reduce((acc, b) => acc + b.earnings, 0);

    return {
      bars,
      averageMinutes: Math.round(totalMin / 7),
      averageEarnings: Math.round(totalEarn / 7),
    };
  }

  if (tf === '1M') {
    // Intervals of the selected month
    const intervals = [
      { label: '1–7', minDay: 1, maxDay: 7 },
      { label: '8–14', minDay: 8, maxDay: 14 },
      { label: '15–21', minDay: 15, maxDay: 21 },
      { label: '22–28', minDay: 22, maxDay: 28 },
      { label: '29–31', minDay: 29, maxDay: 31 },
    ];

    const buckets = intervals.map((iv) => ({
      ...iv,
      minutes: 0,
      earnings: 0,
    }));

    entries.forEach((e) => {
      if (!e.started_at) return;
      const d = new Date(e.started_at);
      if (
        d.getFullYear() === anchorDate.value.getFullYear() &&
        d.getMonth() === anchorDate.value.getMonth()
      ) {
        const day = d.getDate();
        const targetBucket = buckets.find((b) => day >= b.minDay && day <= b.maxDay);
        if (targetBucket) {
          const { earnings, durationMinutes } = calculateEntryEarnings(
            e,
            projects.value.find((p) => p.id === e.project_id),
            targetProfile.value
          );
          targetBucket.minutes += durationMinutes;
          targetBucket.earnings += earnings;
        }
      }
    });

    const maxMinutes = Math.max(1, ...buckets.map((b) => b.minutes));
    const bars: BarItem[] = buckets.map((b) => ({
      label: b.label,
      minutes: b.minutes,
      earnings: Math.round(b.earnings * 100) / 100,
      heightPercent: Math.round((b.minutes / maxMinutes) * 100),
      isMax: b.minutes === maxMinutes && b.minutes > 0,
    }));

    const totalMin = buckets.reduce((acc, b) => acc + b.minutes, 0);
    const totalEarn = buckets.reduce((acc, b) => acc + b.earnings, 0);

    return {
      bars,
      averageMinutes: Math.round(totalMin / buckets.length),
      averageEarnings: Math.round(totalEarn / buckets.length),
    };
  }

  if (tf === '6M') {
    // 6 consecutive months ending in selected month
    const monthBuckets: { label: string; year: number; month: number; minutes: number; earnings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() - i, 1);
      monthBuckets.push({
        label: d.toLocaleString(undefined, { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        minutes: 0,
        earnings: 0,
      });
    }

    entries.forEach((e) => {
      if (!e.started_at) return;
      const d = new Date(e.started_at);
      const y = d.getFullYear();
      const m = d.getMonth();
      const target = monthBuckets.find((b) => b.year === y && b.month === m);
      if (target) {
        const { earnings, durationMinutes } = calculateEntryEarnings(
          e,
          projects.value.find((p) => p.id === e.project_id),
          targetProfile.value
        );
        target.minutes += durationMinutes;
        target.earnings += earnings;
      }
    });

    const maxMinutes = Math.max(1, ...monthBuckets.map((b) => b.minutes));
    const bars: BarItem[] = monthBuckets.map((b) => ({
      label: b.label,
      minutes: b.minutes,
      earnings: Math.round(b.earnings * 100) / 100,
      heightPercent: Math.round((b.minutes / maxMinutes) * 100),
      isMax: b.minutes === maxMinutes && b.minutes > 0,
    }));

    const totalMin = monthBuckets.reduce((acc, b) => acc + b.minutes, 0);
    const totalEarn = monthBuckets.reduce((acc, b) => acc + b.earnings, 0);

    return {
      bars,
      averageMinutes: Math.round(totalMin / monthBuckets.length),
      averageEarnings: Math.round(totalEarn / monthBuckets.length),
    };
  }

  if (tf === '1Y') {
    // 12 months (Jan-Dec) of selected calendar year
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets = monthNames.map((name, idx) => ({
      label: name,
      month: idx,
      year: anchorDate.value.getFullYear(),
      minutes: 0,
      earnings: 0,
    }));

    entries.forEach((e) => {
      if (!e.started_at) return;
      const d = new Date(e.started_at);
      if (d.getFullYear() === anchorDate.value.getFullYear()) {
        const m = d.getMonth();
        if (buckets[m]) {
          const { earnings, durationMinutes } = calculateEntryEarnings(
            e,
            projects.value.find((p) => p.id === e.project_id),
            targetProfile.value
          );
          buckets[m].minutes += durationMinutes;
          buckets[m].earnings += earnings;
        }
      }
    });

    const maxMinutes = Math.max(1, ...buckets.map((b) => b.minutes));
    const bars: BarItem[] = buckets.map((b) => ({
      label: b.label,
      minutes: b.minutes,
      earnings: Math.round(b.earnings * 100) / 100,
      heightPercent: Math.round((b.minutes / maxMinutes) * 100),
      isMax: b.minutes === maxMinutes && b.minutes > 0,
    }));

    const totalMin = buckets.reduce((acc, b) => acc + b.minutes, 0);
    const totalEarn = buckets.reduce((acc, b) => acc + b.earnings, 0);

    return {
      bars,
      averageMinutes: Math.round(totalMin / 12),
      averageEarnings: Math.round(totalEarn / 12),
    };
  }

  // ALL: Years present or recent years
  const startYear = entries.length > 0
    ? Math.min(...entries.map((e) => new Date(e.started_at).getFullYear()))
    : new Date().getFullYear();
  const endYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = Math.max(startYear, endYear - 4); y <= endYear; y++) {
    years.push(y);
  }
  if (years.length === 0) years.push(endYear);

  const yearBuckets = years.map((y) => ({
    label: String(y),
    year: y,
    minutes: 0,
    earnings: 0,
  }));

  entries.forEach((e) => {
    if (!e.started_at) return;
    const d = new Date(e.started_at);
    const target = yearBuckets.find((b) => b.year === d.getFullYear());
    if (target) {
      const { earnings, durationMinutes } = calculateEntryEarnings(
        e,
        projects.value.find((p) => p.id === e.project_id),
        targetProfile.value
      );
      target.minutes += durationMinutes;
      target.earnings += earnings;
    }
  });

  const maxMinutes = Math.max(1, ...yearBuckets.map((b) => b.minutes));
  const bars: BarItem[] = yearBuckets.map((b) => ({
    label: b.label,
    minutes: b.minutes,
    earnings: Math.round(b.earnings * 100) / 100,
    heightPercent: Math.round((b.minutes / maxMinutes) * 100),
    isMax: b.minutes === maxMinutes && b.minutes > 0,
  }));

  const totalMin = yearBuckets.reduce((acc, b) => acc + b.minutes, 0);
  const totalEarn = yearBuckets.reduce((acc, b) => acc + b.earnings, 0);

  return {
    bars,
    averageMinutes: Math.round(totalMin / yearBuckets.length),
    averageEarnings: Math.round(totalEarn / yearBuckets.length),
  };
});

// Display metrics in Hero Card (updates dynamically when a bar is selected)
const activeDisplayMetrics = computed(() => {
  if (selectedBarIndex.value !== null && barChartData.value.bars[selectedBarIndex.value]) {
    const selectedBar = barChartData.value.bars[selectedBarIndex.value];
    return {
      minutesText: formatMinutes(selectedBar.minutes),
      earningsText: `${detectedCurrency.value} ${selectedBar.earnings.toFixed(2)}`,
      subLabel: `${selectedBar.label}${selectedBar.subLabel ? ' (' + selectedBar.subLabel + ')' : ''} interval`,
      isSelected: true,
    };
  }
  return {
    minutesText: formatMinutes(analyticsData.value.totalMinutes),
    earningsText: `${detectedCurrency.value} ${analyticsData.value.totalEarnings.toFixed(2)}`,
    subLabel: currentInterval.value.label,
    isSelected: false,
  };
});

function toggleSelectBar(idx: number) {
  if (selectedBarIndex.value === idx) {
    selectedBarIndex.value = null;
  } else {
    selectedBarIndex.value = idx;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex pointer-events-none"
      :class="{ 'pointer-events-auto': isOpen }"
    >
      <!-- Backdrop Transition -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 bg-black/80 backdrop-blur-xs pointer-events-auto"
          @click="handleClose"
        ></div>
      </Transition>

      <!-- Main Slide-Over Panel (Slides in from Right) -->
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-300 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="isOpen"
          ref="mainPanelRef"
          data-slideover="true"
          class="fixed inset-y-0 right-0 max-w-full w-full sm:w-88 bg-[#161618] text-white shadow-2xl flex flex-col z-50 border-l border-[#262930] pointer-events-auto select-none"
          >
          <!-- Header Area with Dynamic Back/Close Transition & Title -->
          <div
            class="px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-2 shrink-0"
            style="padding-top: calc(1.5rem + env(safe-area-inset-top));"
          >
            <!-- Left Action Button: ChevronLeft if in project drilldown, X if main -->
            <button
              @click="selectedProjectId ? handleCloseSubSlide() : handleClose()"
              class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center overflow-hidden"
              :title="selectedProjectId ? 'Back to Analytics' : 'Close'"
            >
              <Transition name="fade" mode="out-in">
                <ChevronLeft v-if="selectedProjectId" key="back" class="w-7 h-7" />
                <X v-else key="close" class="w-7 h-7" />
              </Transition>
            </button>

            <!-- Dynamic Center Title & Subtitle with Transitions -->
            <div class="flex flex-col items-center justify-center w-full min-w-0 px-2">
              <Transition name="fade" mode="out-in">
                <h2 :key="selectedProjectId || targetUserId || 'main'" class="text-xl font-bold text-center w-full text-white tracking-tight truncate">
                  <template v-if="selectedProjectId && currentProject">
                    {{ currentProject.name }}
                  </template>
                  <template v-else-if="isViewingOtherMember">
                    {{ targetDisplayName }}
                  </template>
                </h2>
              </Transition>
            </div>

            <!-- Right Header Action: Quick CSV Export for Owners/Co-owners or Chart Icon -->
            <div class="shrink-0 flex items-center justify-end">
              <button
                v-if="isOwner && activeEntries.length > 0 && !isMainPage"
                @click="handleExportStatsCsv"
                class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Export CSV"
              >
                <Download class="w-7 h-7" />
              </button>
              <div v-else class="p-1.5 text-[#b3b3b3] opacity-60">
                <BarChart3 class="w-7 h-7" />
              </div>
            </div>
          </div>

          <!-- Body Content Area -->
          <div ref="contentScrollRef" class="flex-1 overflow-y-auto p-4 pb-20">
            <Transition name="csgo-fade" mode="out-in">
              <div :key="selectedProjectId || 'main'" class="space-y-4">
                <!-- Period Timeframe Filter Pills (1W, 1M, 6M, 1Y, ALL) -->
            <div class="bg-[#252525] p-1.5 rounded-lg flex items-center justify-between gap-1">
              <button
                v-for="tf in (['1W', '1M', '6M', '1Y', 'ALL'] as TimeFrame[])"
                :key="tf"
                @click="selectedTimeframe = tf"
                class="flex-1 py-1.5 font-bold rounded-md transition-all border text-center cursor-pointer"
                :class="
                  selectedTimeframe === tf
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                {{ tf }}
              </button>
            </div>

            <!-- Interval Navigation Bar (< Sept 16 - 23, 2026 [calendar icon] >) -->
            <div v-if="selectedTimeframe !== 'ALL'" class="bg-[#1e1e20] border border-[#2d2d30] px-3 py-2 rounded-lg flex items-center justify-between gap-2 select-none">
              <button
                type="button"
                @click="navigateInterval(-1)"
                class="p-1 rounded-md text-[#888888] hover:text-white hover:bg-[#28282b] active:scale-90 transition-all cursor-pointer"
                title="Previous interval"
              >
                <ChevronLeft class="w-5 h-5" />
              </button>

              <div class="flex items-center gap-2">
                <span class="font-bold text-white tracking-tight">
                  {{ currentInterval.label }}
                </span>
                <div class="relative flex items-center">
                  <button
                    type="button"
                    @click="triggerDatePicker"
                    class="p-1 rounded-md text-[#5bb8f5] hover:text-[#7ac0e3] hover:bg-[#28282b] transition-all cursor-pointer"
                    title="Choose date / interval"
                  >
                    <Calendar class="w-5 h-5" />
                  </button>
                  <input
                    ref="datePickerInput"
                    type="date"
                    @change="handleDatePicked"
                    style="color-scheme: dark;"
                    class="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
                  />
                </div>
              </div>

              <button
                type="button"
                @click="navigateInterval(1)"
                class="p-1 rounded-md text-[#888888] hover:text-white hover:bg-[#28282b] active:scale-90 transition-all cursor-pointer"
                title="Next interval"
              >
                <ChevronRight class="w-5 h-5" />
              </button>
            </div>

            <!-- 1. HERO TOTALS & INTERACTIVE BAR CHART CARD -->
            <div class="bg-[#252525] p-4 rounded-lg space-y-4" @click="selectedBarIndex = null">
              <!-- Top Row: Hours & Money Metrics (Updates when bar is selected) -->
              <div class="flex items-start justify-between">
                <div>
                  <div class="text-3xl sm:text-4xl font-bold tracking-tight transition-all" :class="[ activeDisplayMetrics.isSelected ? ' text-[#5bb8f5]' : 'text-white']">
                    {{ activeDisplayMetrics.minutesText }}
                  </div>
                </div>

                <div class="text-right">
                  <div class="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight">
                    {{ activeDisplayMetrics.earningsText }}
                  </div>
                </div>
              </div>

              <!-- Interactive Bar Chart with Opacity Transition on Selection -->
              <div>
                <div class="h-32 flex overflow-x-auto items-end justify-between gap-2 pt-4 px-2 border-b border-[#333333]">
                  <div
                    v-for="(bar, idx) in barChartData.bars"
                    :key="idx"
                    @click.stop="toggleSelectBar(idx)"
                    class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer transition-all duration-300 select-none"
                    :class="{
                      'opacity-30': selectedBarIndex !== null && selectedBarIndex !== idx,
                      'opacity-100': selectedBarIndex === null || selectedBarIndex === idx,
                    }"
                  >
                    <div
                      class="w-full min-w-6 max-w-8 bg-[#333333] rounded-t-lg relative flex flex-col justify-end overflow-hidden transition-all duration-300 min-h-0.5"
                      :class="selectedBarIndex === idx ? 'ring-2 ring-[#5bb8f5] ring-offset-1 ring-offset-[#252525]' : ''"
                      :style="{ height: `${Math.max(4, bar.heightPercent)}%` }"
                    >
                      <div
                        class="w-full h-full rounded-t-md transition-colors"
                        :class="
                          selectedBarIndex === idx
                            ? 'bg-[#5bb8f5]'
                            : bar.isMax
                            ? 'bg-gradient-to-t from-[#5bb8f5] to-[#7ac0e3]'
                            : bar.minutes > 0
                            ? 'bg-neutral-200 group-hover:bg-[#5bb8f5]'
                            : 'bg-[#333333]'
                        "
                      ></div>
                    </div>
                  </div>
                </div>

                <!-- X-Axis Labels -->
                <div class="flex items-center justify-between gap-2 px-2 pt-2 text-[11px] font-semibold text-[#888888]">
                  <div
                    v-for="(bar, idx) in barChartData.bars"
                    :key="idx"
                    @click="toggleSelectBar(idx)"
                    class="flex-1 text-center truncate cursor-pointer transition-colors"
                    :class="selectedBarIndex === idx ? 'text-[#5bb8f5] font-bold' : 'hover:text-white'"
                  >
                    <div>{{ bar.label }}</div>
                    <div v-if="bar.subLabel" class="text-[9px] opacity-70">{{ bar.subLabel }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. STATS STATUS CARDS (Awaiting, Approved, Paid, Not Paid) -->
            <div>
              <div class="grid grid-cols-2 gap-2">
                <!-- Awaiting Block -->
                <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-[#333333] transition-colors">
                  <div class="flex items-center justify-end gap-1.5 text-[#888888] font-semibold">
                    <Loader class="w-5 h-5 shrink-0" />
                  </div>
                  <div class="font-bold text-white truncate text-sm sm:text-base">
                    {{ formatMinutes(analyticsData.awaitingMinutes) }}
                  </div>
                  <div class="text-[#888888] truncate text-xs">
                    {{ detectedCurrency }} {{ analyticsData.awaitingEarnings.toFixed(2) }}
                  </div>
                </div>

                <!-- Approved Block -->
                <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-emerald-500/30 transition-colors">
                  <div class="flex items-center justify-end gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 class="w-5 h-5 shrink-0" />
                  </div>
                  <div class="font-bold text-white truncate text-sm sm:text-base">
                    {{ formatMinutes(analyticsData.approvedMinutes) }}
                  </div>
                  <div class="text-emerald-400 truncate text-xs">
                    {{ detectedCurrency }} {{ analyticsData.approvedEarnings.toFixed(2) }}
                  </div>
                </div>

                <!-- Paid Block -->
                <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-emerald-500/30 transition-colors">
                  <div class="flex items-center justify-end gap-1.5 text-emerald-400 font-semibold">
                    <CircleDollarSign class="w-5 h-5 shrink-0" />
                  </div>
                  <div class="font-bold text-white truncate text-sm sm:text-base">
                    {{ formatMinutes(analyticsData.paidMinutes) }}
                  </div>
                  <div class="text-emerald-400 truncate text-xs">
                    {{ detectedCurrency }} {{ analyticsData.paidEarnings.toFixed(2) }}
                  </div>
                </div>

                <!-- Not Paid Block -->
                <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-rose-500/30 transition-colors">
                  <div class="flex items-center justify-end gap-1.5 text-rose-400 font-semibold">
                    <AlertCircle class="w-5 h-5 shrink-0" />
                  </div>
                  <div class="font-bold text-white truncate text-sm sm:text-base">
                    {{ formatMinutes(analyticsData.notPaidMinutes) }}
                  </div>
                  <div class="text-rose-400 truncate text-xs">
                    {{ detectedCurrency }} {{ analyticsData.notPaidEarnings.toFixed(2) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 3A. MAIN VIEW: BREAKDOWN BY PROJECT -->
            <div v-if="!selectedProjectId" class="space-y-2">
              <div v-if="analyticsData.projectBreakdown.length > 0" class="bg-[#252525] p-2 rounded-lg space-y-1 max-h-90 overflow-y-auto">
                <div
                  v-for="item in analyticsData.projectBreakdown"
                  :key="item.project.id"
                  @click="selectedProjectId = item.project.id"
                  class="p-2 rounded-lg hover:bg-[#1f1f21] active:scale-[0.99] cursor-pointer transition-all flex items-center justify-between gap-3"
                >
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      class="w-2 h-2 rounded-full shrink-0"
                      :style="{ backgroundColor: item.color }"
                    ></div>

                    <div class="min-w-0 flex-1">
                      <div class="font-semibold text-white truncate">
                        {{ item.project.name }}
                      </div>
                      <div class="flex items-center gap-2 text-sm text-[#888888] mt-0.5">
                        <span>{{ item.entriesCount }} entries</span>
                        <span>&bull;</span>
                        <span>{{ formatMinutes(item.totalMinutes) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <div class="text-sm font-bold text-white font-mono">
                        {{ detectedCurrency }} {{ item.totalEarnings.toFixed(2) }}
                      </div>
                      <div class="text-sm text-[#888888]">
                        {{
                          analyticsData.totalMinutes > 0
                            ? Math.round((item.totalMinutes / analyticsData.totalMinutes) * 100)
                            : 0
                        }}%
                      </div>
                    </div>
                    <ChevronRight class="w-5 h-5 text-[#888888]" />
                  </div>
                </div>
              </div>

              <div v-else class="bg-[#252525] p-6 rounded-lg text-center text-xs text-[#888888] italic">
                No time tracked in this period.
              </div>
            </div>

            <!-- 3B. PROJECT DRILLDOWN VIEW: BREAKDOWN BY TASK -->
            <div v-else class="space-y-4">
              <!-- Active Rate Tag Note for this project -->
              <div
                v-if="analyticsData.activeRateInfo?.ruleTitle"
                class="bg-[#252525] p-3 rounded-lg flex items-center justify-between"
              >
                <div class="flex items-center gap-2 text-white font-semibold">
                  <span><span class="text-[#5bb8f5]">Rule:</span> {{ analyticsData.activeRateInfo.ruleTitle }}</span>
                </div>
                <div class="font-mono font-bold text-emerald-400">
                  {{ analyticsData.activeRateInfo.rate }} {{ detectedCurrency }}/h
                </div>
              </div>

              <!-- By Task Section -->
              <div class="space-y-2">
                <div v-if="analyticsData.taskBreakdown.length > 0" class="bg-[#252525] max-h-72 overflow-y-auto p-2 rounded-lg space-y-1">
                  <div
                    v-for="(t, idx) in analyticsData.taskBreakdown"
                    :key="idx"
                    class="p-2 rounded-lg flex items-center justify-between gap-3"
                  >
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <div class="min-w-0 flex-1">
                        <div class="font-semibold text-white truncate">
                          {{ t.taskName }}
                        </div>
                        <div class="text-sm text-[#888888] mt-0.5">
                          {{ t.entriesCount }} entr{{ t.entriesCount === 1 ? 'y' : 'ies' }} &bull; {{ formatMinutes(t.totalMinutes) }}
                        </div>
                      </div>
                    </div>

                    <div class="text-right shrink-0">
                      <div class="font-bold text-white">
                        {{ detectedCurrency }} {{ t.totalEarnings.toFixed(2) }}
                      </div>
                      <div class="text-sm text-[#888888]">
                        {{
                          analyticsData.totalMinutes > 0
                            ? Math.round((t.totalMinutes / analyticsData.totalMinutes) * 100)
                            : 0
                        }}%
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="bg-[#252525] p-6 rounded-lg text-center text-xs text-[#888888] italic">
                  No tasks tracked for this project in this timeframe.
                </div>
              </div>

              <div v-if="activeEntries.length > 0" class="h-px flex w-full bg-[#252525]"></div>

              <!-- Recent Time Entries for this project -->
              <div class="space-y-2">
                <div v-if="activeEntries.length > 0" class="bg-[#252525] max-h-72 overflow-y-auto p-2 rounded-lg">
                  <div
                    v-for="entry in activeEntries"
                    :key="entry.id"
                    class="p-2.5 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div class="text-white font-medium">
                        {{ new Date(entry.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
                      </div>
                      <div class="text-sm text-[#888888]">
                        {{ entry.tasks?.name || '' }}
                      </div>
                    </div>

                    <div class="text-right">
                      <div class="font-bold text-white">
                        {{ formatMinutes(calculateEntryEarnings(entry, currentProject, targetProfile).durationMinutes) }}
                      </div>
                      <div class="text-sm text-emerald-400">
                        {{ detectedCurrency }} {{ calculateEntryEarnings(entry, currentProject, targetProfile).earnings.toFixed(2) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</div>
</Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.csgo-fade-enter-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.csgo-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.7, 0, 0.84, 0), transform 0.25s cubic-bezier(0.7, 0, 0.84, 0);
}
.csgo-fade-enter-from {
  opacity: 0;
  transform: scale(0.985);
}
.csgo-fade-leave-to {
  opacity: 0;
  transform: scale(1.015);
}
</style>
