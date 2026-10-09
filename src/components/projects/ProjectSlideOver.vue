<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useSpace } from '@/composables/useSpace';
import { useProjects } from '@/composables/useProjects';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useSwipeGesture } from '@/composables/useSwipeGesture';
import { calculateEntryEarnings, getProjectBillingRate, calculateAge } from '@/lib/billing';
import type { Project, Task, ProjectBillingRule, AgeOperator, TimeEntry, EntryStatus } from '@/types';
import {
  X,
  ChevronLeft,
  Clock,
  Coins,
  CheckCircle2,
  CircleDollarSign,
  Loader,
  Folder,
  Tag,
  CheckSquare,
  BarChart3,
  User,
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  Settings,
  ListTodo,
  Download,
} from 'lucide-vue-next';
import { useExportCsv } from '@/composables/useExportCsv';

interface Props {
  isOpen: boolean;
  projectId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'update:projectId']);

const router = useRouter();
const route = useRoute();
const { profile } = useAuth();
const { currentSpace, isOwner, spaceMembers } = useSpace();
const {
  projects,
  updateProjectResponsible,
  updateProjectBillingRules,
  renameProject,
  deleteProject,
  createTask,
  renameTask,
  deleteTask,
} = useProjects();
const { spaceTeamEntries, userEntries, fetchSpaceTeamEntries, fetchUserEntries } = useTimeEntries();
const { exportEntriesToCsv } = useExportCsv();

function handleExportProjectCsv() {
  if (currentSpace.value && currentProject.value && activeEntries.value.length > 0) {
    const spaceSlug = `${currentSpace.value.name}_${currentProject.value.name}`.replace(/[^a-z0-9]/gi, '_');
    exportEntriesToCsv(activeEntries.value, spaceSlug);
  }
}

const mainPanelRef = ref<HTMLElement | null>(null);
const contentScrollRef = ref<HTMLElement | null>(null);

// Active Tab inside SlideOver: 'stats' | 'tasks' | 'settings'
type TabType = 'stats' | 'tasks' | 'settings';
const activeTab = ref<TabType>('stats');

// Timeframe selector: '1W' | '1M' | '6M' | '1Y' | 'ALL'
type TimeFrame = '1W' | '1M' | '6M' | '1Y' | 'ALL';
const selectedTimeframe = ref<TimeFrame>('1M');

// Selected Bar on chart
const selectedBarIndex = ref<number | null>(null);

// Tasks state
const newTaskInput = ref('');
const editingTaskId = ref<string | null>(null);
const editTaskNameInput = ref('');

// Project rename state
const isEditingProjectName = ref(false);
const editProjectNameInput = ref('');

// Billing rules state
const addingRule = ref(false);
const newRuleTitle = ref('Name');
const newRuleOp = ref<AgeOperator>('<=');
const newRuleAge = ref<number>(20);
const newRuleRate = ref<number>(4);
const newRuleCurrency = ref('€');
const isSavingRule = ref(false);

// Reset bar selection on timeframe or tab switch
watch([selectedTimeframe, activeTab, () => props.projectId], () => {
  selectedBarIndex.value = null;
  newTaskInput.value = '';
  editingTaskId.value = null;
  addingRule.value = false;
  isEditingProjectName.value = false;
});

// Scroll to top when opening or changing project
watch(
  () => props.projectId,
  async (newId) => {
    if (newId) {
      const proj = projects.value.find((p) => p.id === newId);
      if (proj) {
        editProjectNameInput.value = proj.name;
      }
    }
    await nextTick();
    if (contentScrollRef.value) {
      contentScrollRef.value.scrollTop = 0;
    }
    if (mainPanelRef.value) {
      mainPanelRef.value.scrollTop = 0;
    }
  }
);

// Swipe gesture to close
useSwipeGesture(mainPanelRef, {
  onSwipeRight: () => {
    if (props.isOpen) {
      handleClose();
    }
  },
});

// Current Project object
const currentProject = computed<Project | null>(() => {
  if (!props.projectId) return null;
  return projects.value.find((p) => p.id === props.projectId) || null;
});

// Route & Query Synchronization + Scroll Lock
watch(
  () => props.isOpen,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      if (props.projectId && route.query.project !== props.projectId) {
        router.push({ query: { ...route.query, project: props.projectId } });
      }
      if (currentSpace.value) {
        if (isOwner.value) {
          await fetchSpaceTeamEntries(currentSpace.value.id);
        } else {
          await fetchUserEntries(currentSpace.value.id);
        }
      }
    } else {
      if (route.query.project) {
        const query = { ...route.query };
        delete query.project;
        router.replace({ query });
      }
    }
  }
);

function handleClose() {
  activeTab.value = 'stats';
  selectedTimeframe.value = '1M';
  emit('close');
  if (route.query.project) {
    router.back();
  }
}

// Relevant Entries (Team entries if owner, user entries if member)
const relevantEntries = computed<TimeEntry[]>(() => {
  if (!props.projectId) return [];
  const source = isOwner.value ? spaceTeamEntries.value : userEntries.value;
  return source.filter((e) => e.project_id === props.projectId && e.started_at);
});

// Timeframe Filtered Entries
const filteredEntries = computed<TimeEntry[]>(() => {
  const cutoff = new Date();
  const tf = selectedTimeframe.value;

  if (tf === '1W') {
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (tf === '1M') {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (tf === '6M') {
    cutoff.setMonth(cutoff.getMonth() - 6);
  } else if (tf === '1Y') {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  }

  const cutoffTime = tf === 'ALL' ? 0 : cutoff.getTime();

  return relevantEntries.value.filter((e) => {
    if (!e.started_at) return false;
    if (cutoffTime > 0 && new Date(e.started_at).getTime() < cutoffTime) return false;
    return true;
  });
});

function isEntryInBar(entry: TimeEntry, barIdx: number, tf: TimeFrame): boolean {
  if (!entry.started_at) return false;
  const d = new Date(entry.started_at);

  if (tf === '1W') {
    const dayIdx = (d.getDay() + 6) % 7;
    return dayIdx === barIdx;
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
    return day >= target.minDay && day <= target.maxDay;
  }

  // 6M | 1Y | ALL
  const monthCount = tf === '6M' ? 6 : 12;
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() - (monthCount - 1 - barIdx));
  return d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth();
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

// Primary Currency
const detectedCurrency = computed(() => {
  if (currentProject.value?.billing_rules && currentProject.value.billing_rules.length > 0) {
    for (const r of currentProject.value.billing_rules) {
      if (r.currency) return r.currency;
    }
  }
  return '€';
});

// Aggregated Analytics for the selected project (derived from activeEntries)
const analyticsData = computed(() => {
  let totalMinutes = 0;
  let totalEarnings = 0;
  let paidEarnings = 0;
  let approvedEarnings = 0;
  let awaitingEarnings = 0;

  let paidMinutes = 0;
  let approvedMinutes = 0;
  let awaitingMinutes = 0;

  const memberMap = new Map<
    string,
    {
      userId: string;
      name: string;
      email: string;
      age?: number | null;
      avatarUrl?: string | null;
      totalMinutes: number;
      totalEarnings: number;
      entriesCount: number;
    }
  >();

  const taskMap = new Map<
    string,
    {
      taskId: string;
      taskName: string;
      totalMinutes: number;
      totalEarnings: number;
      entriesCount: number;
    }
  >();

  activeEntries.value.forEach((entry) => {
    const prof = entry.profiles || (entry.user_id === profile.value?.id ? profile.value : null);
    const { earnings, durationMinutes } = calculateEntryEarnings(entry, currentProject.value, prof);

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
      // Not paid - do not count towards awaiting
    } else {
      awaitingEarnings += earnings;
      awaitingMinutes += durationMinutes;
    }

    // Team Member breakdown ("Entries by Who")
    const userId = entry.user_id;
    let memberItem = memberMap.get(userId);
    if (!memberItem) {
      const spaceM = spaceMembers.value.find((m) => m.user_id === userId);
      const name = prof?.full_name || spaceM?.profiles?.full_name || prof?.email || spaceM?.profiles?.email || 'Team Member';
      const email = prof?.email || spaceM?.profiles?.email || '';
      const dob = prof?.dob || spaceM?.profiles?.dob;
      const age = calculateAge(dob);
      memberItem = {
        userId,
        name,
        email,
        age,
        avatarUrl: prof?.avatar_url || spaceM?.profiles?.avatar_url || null,
        totalMinutes: 0,
        totalEarnings: 0,
        entriesCount: 0,
      };
      memberMap.set(userId, memberItem);
    }
    if (memberItem) {
      memberItem.totalMinutes += durationMinutes;
      memberItem.totalEarnings += earnings;
      memberItem.entriesCount += 1;
    }

    // Task breakdown
    const taskId = entry.task_id || 'unassigned';
    const taskName = entry.tasks?.name || 'No task';
    let taskItem = taskMap.get(taskId);
    if (!taskItem) {
      taskItem = {
        taskId,
        taskName,
        totalMinutes: 0,
        totalEarnings: 0,
        entriesCount: 0,
      };
      taskMap.set(taskId, taskItem);
    }
    taskItem.totalMinutes += durationMinutes;
    taskItem.totalEarnings += earnings;
    taskItem.entriesCount += 1;
  });

  const memberBreakdown = Array.from(memberMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  const taskBreakdown = Array.from(taskMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);

  const activeRateInfo = currentProject.value
    ? getProjectBillingRate(currentProject.value, profile.value)
    : null;

  return {
    totalMinutes,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    paidEarnings: Math.round(paidEarnings * 100) / 100,
    approvedEarnings: Math.round(approvedEarnings * 100) / 100,
    awaitingEarnings: Math.round(awaitingEarnings * 100) / 100,
    paidMinutes,
    approvedMinutes,
    awaitingMinutes,
    memberBreakdown,
    taskBreakdown,
    activeRateInfo,
  };
});

// Format minutes helper
function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Interactive Bar Chart Generator
interface BarItem {
  label: string;
  minutes: number;
  earnings: number;
  heightPercent: number;
  isMax?: boolean;
}

const barChartData = computed<{ bars: BarItem[]; averageMinutes: number; averageEarnings: number }>(() => {
  const tf = selectedTimeframe.value;
  const entries = filteredEntries.value;

  if (tf === '1W') {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayBuckets: { [key: number]: { minutes: number; earnings: number } } = {
      0: { minutes: 0, earnings: 0 },
      1: { minutes: 0, earnings: 0 },
      2: { minutes: 0, earnings: 0 },
      3: { minutes: 0, earnings: 0 },
      4: { minutes: 0, earnings: 0 },
      5: { minutes: 0, earnings: 0 },
      6: { minutes: 0, earnings: 0 },
    };

    entries.forEach((e) => {
      if (!e.started_at) return;
      const d = new Date(e.started_at);
      const dayIdx = (d.getDay() + 6) % 7;
      const prof = e.profiles || (e.user_id === profile.value?.id ? profile.value : null);
      const { earnings, durationMinutes } = calculateEntryEarnings(e, currentProject.value, prof);
      dayBuckets[dayIdx].minutes += durationMinutes;
      dayBuckets[dayIdx].earnings += earnings;
    });

    const maxMinutes = Math.max(1, ...Object.values(dayBuckets).map((b) => b.minutes));
    const bars: BarItem[] = days.map((dayName, idx) => {
      const b = dayBuckets[idx];
      return {
        label: dayName,
        minutes: b.minutes,
        earnings: Math.round(b.earnings * 100) / 100,
        heightPercent: Math.round((b.minutes / maxMinutes) * 100),
        isMax: b.minutes === maxMinutes && b.minutes > 0,
      };
    });

    const totalMin = Object.values(dayBuckets).reduce((acc, b) => acc + b.minutes, 0);
    const totalEarn = Object.values(dayBuckets).reduce((acc, b) => acc + b.earnings, 0);

    return {
      bars,
      averageMinutes: Math.round(totalMin / 7),
      averageEarnings: Math.round(totalEarn / 7),
    };
  }

  if (tf === '1M') {
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
      const day = new Date(e.started_at).getDate();
      const targetBucket = buckets.find((b) => day >= b.minDay && day <= b.maxDay);
      if (targetBucket) {
        const prof = e.profiles || (e.user_id === profile.value?.id ? profile.value : null);
        const { earnings, durationMinutes } = calculateEntryEarnings(e, currentProject.value, prof);
        targetBucket.minutes += durationMinutes;
        targetBucket.earnings += earnings;
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

  // 6M or 1Y or ALL
  const monthCount = tf === '6M' ? 6 : 12;
  const monthBuckets: { label: string; year: number; month: number; minutes: number; earnings: number }[] = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
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
      const prof = e.profiles || (e.user_id === profile.value?.id ? profile.value : null);
      const { earnings, durationMinutes } = calculateEntryEarnings(e, currentProject.value, prof);
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
});

const activeDisplayMetrics = computed(() => {
  if (selectedBarIndex.value !== null && barChartData.value.bars[selectedBarIndex.value]) {
    const selectedBar = barChartData.value.bars[selectedBarIndex.value];
    return {
      minutesText: formatMinutes(selectedBar.minutes),
      earningsText: `${detectedCurrency.value} ${selectedBar.earnings.toFixed(2)}`,
      subLabel: `${selectedBar.label} interval`,
      isSelected: true,
    };
  }
  return {
    minutesText: formatMinutes(analyticsData.value.totalMinutes),
    earningsText: `${detectedCurrency.value} ${analyticsData.value.totalEarnings.toFixed(2)}`,
    subLabel: selectedTimeframe.value === '1M' ? 'This month' : selectedTimeframe.value === '1W' ? 'Past 7 days' : selectedTimeframe.value,
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

// Project Actions
function startRenameProject() {
  if (!currentProject.value) return;
  editProjectNameInput.value = currentProject.value.name;
  isEditingProjectName.value = true;
}

async function saveRenameProject() {
  if (!props.projectId || !editProjectNameInput.value.trim()) return;
  await renameProject(props.projectId, editProjectNameInput.value.trim());
  isEditingProjectName.value = false;
}

async function handleResponsibleChange(event: Event) {
  if (!props.projectId) return;
  const target = event.target as HTMLSelectElement;
  const val = target.value || null;
  await updateProjectResponsible(props.projectId, val);
}

async function handleDeleteCurrentProject() {
  if (!props.projectId) return;
  if (confirm('Delete this project? All associated tasks will also be removed.')) {
    const id = props.projectId;
    handleClose();
    await deleteProject(id);
  }
}

// Task Actions
async function handleAddTask() {
  if (!props.projectId || !newTaskInput.value.trim()) return;
  await createTask(props.projectId, newTaskInput.value.trim());
  newTaskInput.value = '';
}

function startRenameTask(task: Task) {
  editingTaskId.value = task.id;
  editTaskNameInput.value = task.name;
}

async function saveRenameTask(taskId: string) {
  if (editTaskNameInput.value.trim()) {
    await renameTask(taskId, editTaskNameInput.value.trim());
  }
  editingTaskId.value = null;
}

async function handleDeleteTask(taskId: string) {
  if (confirm('Delete this task?')) {
    await deleteTask(taskId);
  }
}

// Special Billing Rules
function startAddRule() {
  newRuleTitle.value = 'U18';
  newRuleOp.value = '<=';
  newRuleAge.value = 18;
  newRuleRate.value = 4;
  newRuleCurrency.value = '€';
  addingRule.value = true;
}

async function handleSaveRule() {
  if (!currentProject.value || !newRuleTitle.value.trim() || newRuleAge.value < 0 || newRuleRate.value < 0) return;
  isSavingRule.value = true;

  const currentRules = [...(currentProject.value.billing_rules || [])];
  const newRule: ProjectBillingRule = {
    id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: newRuleTitle.value.trim(),
    age_operator: newRuleOp.value,
    age_threshold: Number(newRuleAge.value),
    hourly_rate: Number(newRuleRate.value),
    currency: newRuleCurrency.value,
  };

  currentRules.push(newRule);
  await updateProjectBillingRules(currentProject.value.id, currentRules);
  isSavingRule.value = false;
  addingRule.value = false;
}

async function handleDeleteRule(ruleId: string) {
  if (!currentProject.value) return;
  const currentRules = (currentProject.value.billing_rules || []).filter((r) => r.id !== ruleId);
  await updateProjectBillingRules(currentProject.value.id, currentRules);
}

function getOperatorDisplay(op: AgeOperator): string {
  switch (op) {
    case '<=':
      return '≤';
    case '>=':
      return '≥';
    case '<':
      return '<';
    case '>':
      return '>';
    case '==':
      return '=';
    case '!=':
      return '≠';
    default:
      return op;
  }
}

function getMemberName(userId?: string | null): string | null {
  if (!userId) return null;
  const m = spaceMembers.value.find((sm) => sm.user_id === userId);
  return m?.profiles?.full_name || m?.profiles?.email || null;
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
          v-if="isOpen && currentProject"
          ref="mainPanelRef"
          data-slideover="true"
          class="fixed inset-y-0 right-0 max-w-full w-full sm:w-88 md:w-[480px] bg-[#161618] text-white shadow-2xl flex flex-col z-50 border-l border-[#262930] pointer-events-auto select-none"
        >
          <!-- Header Area -->
          <div
            class="px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-2 shrink-"
            style="padding-top: calc(1.5rem + env(safe-area-inset-top));"
          >
            <!-- Left Action Button: Close -->
            <button
              @click="handleClose"
              class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Close"
            >
              <X class="w-7 h-7" />
            </button>

            <!-- Project Title (Editable inline if owner) -->
            <div class="flex flex-col items-center justify-center w-full min-w-0 px-2">
              <div v-if="!isEditingProjectName" class="flex items-center gap-1.5 max-w-full">
                <h2 class="text-xl font-bold text-center text-white tracking-tight truncate">
                  {{ currentProject.name }}
                </h2>
                <button
                  v-if="isOwner"
                  @click="startRenameProject"
                  class="text-[#888888] hover:text-white transition-colors p-1 cursor-pointer ml-1"
                  title="Rename Project"
                >
                  <Pencil class="w-4 h-4" />
                </button>
              </div>

              <!-- Inline Quick Rename Form in Header -->
              <div v-else class="flex items-center gap-1 w-full max-w-xs">
                <input
                  v-model="editProjectNameInput"
                  type="text"
                  class="h-8 bg-[#252525] border border-[#5bb8f5] rounded px-2 text-white focus:outline-none w-full"
                  autofocus
                  @keyup.enter="saveRenameProject"
                />
                <button
                  @click="saveRenameProject"
                  class="p-1.5 bg-[#5bb8f5] text-black rounded hover:bg-[#7ac0e3] transition-colors cursor-pointer"
                >
                  <Check class="w-5 h-5 stroke-3" />
                </button>
                <button
                  @click="isEditingProjectName = false"
                  class="p-1.5 bg-[#252525] text-[#888888] hover:text-white rounded transition-colors cursor-pointer"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Right Header Icon / Action: Quick CSV Export for Owners/Co-owners or Folder Icon -->
            <div class="shrink-0 flex items-center justify-end">
              <button
                v-if="isOwner && activeEntries.length > 0"
                @click="handleExportProjectCsv"
                class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Export Project CSV"
              >
                <Download class="w-7 h-7" />
              </button>
              <div v-else class="p-1.5 text-[#b3b3b3] opacity-60">
                <Folder class="w-7 h-7" />
              </div>
            </div>
          </div>

          <!-- Segmented Tab Navigation -->
          <div class="px-4 pt-3 pb-1 shrink-0">
            <div class="bg-[#252525] p-1 rounded-lg flex items-center justify-between gap-1">
              <button
                @click="activeTab = 'stats'"
                class="flex-1 py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                :class="
                  activeTab === 'stats'
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                <BarChart3 class="w-5 h-5" />
              </button>

              <button
                @click="activeTab = 'tasks'"
                class="flex-1 py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                :class="
                  activeTab === 'tasks'
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                <ListTodo class="w-5 h-5" />
              </button>

              <button
                @click="activeTab = 'settings'"
                class="flex-1 py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                :class="
                  activeTab === 'settings'
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                <Settings class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Body Content Area -->
          <div ref="contentScrollRef" class="flex-1 overflow-y-auto p-4 pb-20">
            <Transition name="csgo-fade" mode="out-in">
              <!-- TAB 1: STATS & ANALYTICS -->
              <div v-if="activeTab === 'stats'" key="stats" class="space-y-4">
                <!-- Period Timeframe Filter Pills -->
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

                <!-- HERO TOTALS & INTERACTIVE BAR CHART CARD -->
                <div class="bg-[#252525] p-4 rounded-lg space-y-4" @click="selectedBarIndex = null">
                  <div class="flex items-start justify-between">
                    <div>
                      <div
                        class="text-3xl sm:text-4xl font-bold tracking-tight transition-all"
                        :class="[activeDisplayMetrics.isSelected ? 'text-[#5bb8f5]' : 'text-white']"
                      >
                        {{ activeDisplayMetrics.minutesText }}
                      </div>
                    </div>

                    <div class="text-right">
                      <div class="text-lg sm:text-xl font-bold text-white tracking-tight">
                        {{ activeDisplayMetrics.earningsText }}
                      </div>
                    </div>
                  </div>

                  <!-- Interactive Bar Chart -->
                  <div>
                    <div class="h-28 flex overflow-x-auto items-end justify-between gap-2 pt-4 px-2 border-b border-[#333333]">
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
                          class="w-full min-w-5 max-w-8 bg-[#333333] rounded-t-lg relative flex flex-col justify-end overflow-hidden transition-all duration-300 min-h-0.5"
                          :class="selectedBarIndex === idx ? 'ring-2 ring-[#5bb8f5] ring-offset-1 ring-offset-[#252525]' : ''"
                          :style="{ height: `${Math.max(4, bar.heightPercent)}%` }"
                        >
                          <div
                            class="w-full h-full rounded-t-md transition-colors"
                            :class="
                              selectedBarIndex === idx
                                ? 'bg-[#5bb8f5]'
                                : bar.isMax
                                ? 'bg-[#5bb8f5]'
                                : bar.minutes > 0
                                ? 'bg-neutral-300 group-hover:bg-[#5bb8f5]'
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
                        {{ bar.label }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Status Cards (Awaiting, Approved, Paid) -->
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-[#333333] transition-colors">
                    <div class="flex items-center justify-end gap-1.5 text-[#888888]">
                      <Loader class="w-5 h-5 shrink-0" />
                    </div>
                    <div class="font-bold text-white truncate">
                      {{ formatMinutes(analyticsData.awaitingMinutes) }}
                    </div>
                    <div class="text-[#888888] truncate">
                      {{ detectedCurrency }} {{ analyticsData.awaitingEarnings.toFixed(2) }}
                    </div>
                  </div>

                  <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-[#333333] transition-colors">
                    <div class="flex items-center justify-end gap-1.5 text-emerald-400">
                      <CheckCircle2 class="w-5 h-5 shrink-0" />
                    </div>
                    <div class="font-bold text-white truncate">
                      {{ formatMinutes(analyticsData.approvedMinutes) }}
                    </div>
                    <div class="text-[#888888] truncate">
                      {{ detectedCurrency }} {{ analyticsData.approvedEarnings.toFixed(2) }}
                    </div>
                  </div>

                  <div class="bg-[#252525] p-3 rounded-lg flex flex-col justify-between space-y-1.5 border border-transparent hover:border-[#333333] transition-colors">
                    <div class="flex items-center justify-end gap-1.5 text-emerald-400">
                      <CircleDollarSign class="w-5 h-5 shrink-0" />
                    </div>
                    <div class="font-bold text-white truncate">
                      {{ formatMinutes(analyticsData.paidMinutes) }}
                    </div>
                    <div class="text-[#888888] truncate">
                      {{ detectedCurrency }} {{ analyticsData.paidEarnings.toFixed(2) }}
                    </div>
                  </div>
                </div>

                <!-- ENTRIES BY WHO (Team Member Breakdown) -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-[#888888] font-bold px-1">
                    <div class="flex items-center gap-1.5">
                      <Users class="w-5 h-5 text-[#888888]" />
                    </div>
                    <span>{{ analyticsData.memberBreakdown.length }}</span>
                  </div>

                  <div v-if="analyticsData.memberBreakdown.length > 0" class="bg-[#252525] p-1 rounded-lg space-y-1 max-h-64 overflow-y-auto">
                    <div
                      v-for="item in analyticsData.memberBreakdown"
                      :key="item.userId"
                      class="p-2.5 rounded-lg hover:bg-[#1f1f21] transition-colors flex items-center justify-between gap-3"
                    >
                      <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          class="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#333333] flex items-center justify-center font-bold shrink-0 text-white"
                        >
                          {{ item.name.charAt(0).toUpperCase() }}
                        </div>

                        <div class="min-w-0 flex-1">
                          <div class="font-bold text-white truncate">
                            {{ item.name }}
                          </div>
                          <div class="flex items-center gap-2 text-sm text-[#888888] mt-0.5">
                            <span>{{ item.entriesCount }} entr{{ item.entriesCount === 1 ? 'y' : 'ies' }}</span>
                            <span>&bull;</span>
                            <span>{{ formatMinutes(item.totalMinutes) }}</span>
                          </div>
                        </div>
                      </div>

                      <div class="text-right shrink-0">
                        <div class=" font-bold text-white">
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
                    </div>
                  </div>

                  <div v-else class="bg-[#252525] p-6 rounded-lg text-center text-[#888888] italic">
                    No time entries logged for this timeframe.
                  </div>
                </div>

                <!-- RECENT ENTRIES LIST -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-[#888888] font-bold px-1">
                    <div class="flex items-center gap-1.5">
                      <Clock class="w-5 h-5 text-[#888888]" />
                    </div>
                    <span>{{ activeEntries.length }}</span>
                  </div>

                  <div v-if="activeEntries.length > 0" class="bg-[#252525] p-1 rounded-lg space-y-1 max-h-64 overflow-y-auto">
                    <div
                      v-for="entry in activeEntries"
                      :key="entry.id"
                      class="p-2.5 rounded-lg hover:bg-[#1f1f21] transition-colors flex items-center justify-between gap-3 border-b border-[#333333]/30 last:border-0"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="text-white font-bold">
                            {{ new Date(entry.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
                          </span>
                          <span class="text-sm text-[#888888] truncate">
                            {{ entry.profiles?.full_name || entry.profiles?.email || 'Member' }}
                          </span>
                        </div>
                        <div class="text-sm text-[#888888] truncate mt-0.5">
                          {{ entry.tasks?.name || 'No task' }}
                          <span v-if="entry.notes" class="italic text-neutral-400">&mdash; {{ entry.notes }}</span>
                        </div>
                      </div>

                      <div class="text-right shrink-0">
                        <div class="text-sm font-bold text-white">
                          {{ formatMinutes(calculateEntryEarnings(entry, currentProject, entry.profiles).durationMinutes) }}
                        </div>
                        <div class="text-sm text-[#888888]">
                          {{ detectedCurrency }} {{ calculateEntryEarnings(entry, currentProject, entry.profiles).earnings }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-else class="bg-[#252525] p-4 rounded-lg text-center text-[#888888] italic">
                    No entries to display.
                  </div>
                </div>
              </div>

              <!-- TAB 2: TASKS MANAGEMENT -->
              <div v-else-if="activeTab === 'tasks'" key="tasks" class="space-y-4">
                <!-- Inline Add Task Card -->
                <div class="bg-[#252525] p-3 rounded-lg space-y-2">
                  <label class="block font-bold text-white">Add New Task</label>
                  <div class="flex gap-2 items-center">
                    <input
                      v-model="newTaskInput"
                      type="text"
                      @keyup.enter="handleAddTask"
                      class="flex-1 h-10 bg-[#161618] text-white rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666]"
                    />
                    <button
                      @click="handleAddTask"
                      :disabled="!newTaskInput.trim()"
                      class="p-2 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50"
                      title="Add Task"
                    >
                      <Plus class="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <!-- Tasks Checklist -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-[#888888] font-bold px-1">
                    <span></span>
                    <span>{{ (currentProject.tasks || []).length }}</span>
                  </div>

                  <div v-if="!currentProject.tasks || currentProject.tasks.length === 0" class="bg-[#252525] p-8 rounded-lg text-center text-[#888888] italic">
                    No tasks yet.
                  </div>

                  <div v-else class="space-y-1.5">
                    <div
                      v-for="task in currentProject.tasks"
                      :key="task.id"
                      class="flex items-center justify-between gap-2 p-3 bg-[#252525] border border-[#333333]/50 rounded-lg hover:bg-[#2a2a2e] transition-colors min-w-0"
                    >
                      <!-- Inline rename task -->
                      <div v-if="editingTaskId === task.id" class="flex items-center gap-2 w-full">
                        <input
                          v-model="editTaskNameInput"
                          type="text"
                          class="flex-1 min-w-0 h-9 bg-[#161618] border border-[#5bb8f5] rounded-lg px-3 text-white focus:outline-none"
                          autofocus
                          @keyup.enter="saveRenameTask(task.id)"
                        />
                        <button
                          @click="saveRenameTask(task.id)"
                          class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                        >
                          <Check class="w-5 h-5" />
                        </button>
                        <button
                          @click="editingTaskId = null"
                          class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                        >
                          <X class="w-5 h-5" />
                        </button>
                      </div>

                      <template v-else>
                        <div class="flex items-center gap-2.5 font-medium text-white min-w-0 flex-1">
                          <CheckSquare class="w-5 h-5 text-[#888888] shrink-0" />
                          <span class="truncate min-w-0 flex-1 font-semibold">{{ task.name }}</span>
                        </div>

                        <div class="flex items-center gap-1.5 shrink-0">
                          <button
                            v-if="isOwner"
                            @click="startRenameTask(task)"
                            class="p-1.5 text-[#888888] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                            title="Rename task"
                          >
                            <Pencil class="w-5 h-5" />
                          </button>
                          <button
                            v-if="isOwner"
                            @click="handleDeleteTask(task.id)"
                            class="p-1.5 text-[#888888] hover:text-red-400 bg-[#1a1a1a] hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                            title="Delete task"
                          >
                            <Trash2 class="w-5 h-5" />
                          </button>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 3: SETTINGS & BILLING RULES -->
              <div v-else-if="activeTab === 'settings'" key="settings" class="space-y-4">
                <!-- General Project Settings Card -->
                <div class="bg-[#252525] p-4 rounded-lg space-y-4">
                  <div class="font-bold text-white flex items-center">
                    <span>Responsible Team Member</span>
                  </div>

                  <div class="space-y-1.5">
                    <div v-if="isOwner" class="flex items-center gap-2">
                      <select
                        :value="currentProject.responsible_user_id || ''"
                        @change="handleResponsibleChange($event)"
                        class="w-full h-10 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
                      >
                        <option value="">None (Unassigned)</option>
                        <option
                          v-for="member in spaceMembers"
                          :key="member.user_id"
                          :value="member.user_id"
                        >
                          {{ member.profiles?.full_name || member.profiles?.email || 'Member' }}{{ member.profiles?.dob && calculateAge(member.profiles.dob) !== null ? ` (${calculateAge(member.profiles.dob)} yrs)` : '' }}
                        </option>
                      </select>
                    </div>
                    <div v-else class="font-medium text-white p-2.5 bg-[#161618] rounded-lg border border-[#333333]">
                      {{ currentProject.responsible_profile?.full_name || getMemberName(currentProject.responsible_user_id) || 'None' }}
                    </div>
                  </div>
                </div>

                <!-- SPECIAL AGE BILLING RULES CARD -->
                <div class="bg-[#252525] p-4 rounded-lg space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 font-bold text-white">
                      <span>Billing Rules</span>
                      <span class="px-2 text-[#888888]">
                        {{ (currentProject.billing_rules || []).length }}
                      </span>
                    </div>

                    <button
                      v-if="isOwner && !addingRule"
                      @click="startAddRule"
                      class="text-[#5bb8f5] hover:text-[#7ac0e3] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus class="w-5 h-5" />
                      <span>Add Rule</span>
                    </button>
                  </div>

                  <div
                    v-if="addingRule"
                    class="bg-[#1c1c1f] p-3 rounded-lg space-y-3 mt-3"
                  >
                    <div class="font-bold text-white flex items-center gap-1.5">
                      <span>New Billing Rule</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <!-- Title -->
                      <div>
                        <input
                          v-model="newRuleTitle"
                          type="text"
                          placeholder="Name"
                          class="w-full h-8 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded px-2 text-white focus:outline-none"
                        />
                      </div>

                      <!-- Age Operator & Threshold -->
                      <div>
                        <div class="flex items-center gap-1">
                          <select
                            v-model="newRuleOp"
                            class="h-8 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded px-1.5 text-white focus:outline-none cursor-pointer"
                          >
                            <option value="<=">Age &le;</option>
                            <option value="<">Age &lt;</option>
                            <option value=">=">Age &ge;</option>
                            <option value=">">Age &gt;</option>
                            <option value="==">Age =</option>
                          </select>
                          <input
                            v-model="newRuleAge"
                            type="number"
                            placeholder="Age"
                            min="1"
                            max="120"
                            class="w-14 h-8 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded px-2 text-white focus:outline-none text-center"
                          />
                        </div>
                      </div>

                      <!-- Price / Rate -->
                      <div>
                        <div class="flex items-center gap-1">
                          <input
                            v-model="newRuleRate"
                            type="number"
                            placeholder="Hourly rate"
                            step="0.5"
                            min="0"
                            class="flex-1 min-w-0 h-8 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded px-2 text-white focus:outline-none"
                          />
                          <select
                            v-model="newRuleCurrency"
                            class="h-8 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded px-1.5 text-white focus:outline-none cursor-pointer"
                          >
                            <option value="€">€</option>
                            <option value="lei">lei</option>
                            <option value="$">$</option>
                            <option value="£">£</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <!-- Action buttons -->
                    <div class="flex items-center justify-end gap-2 pt-1">
                      <button
                        @click="addingRule = false"
                        class="h-8 px-3 bg-[#252525] hover:bg-[#333333] text-[#888888] hover:text-white rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        @click="handleSaveRule"
                        :disabled="isSavingRule || !newRuleTitle.trim()"
                        class="h-8 px-4 bg-[#5bb8f5] hover:bg-[#7ac0e3] text-black font-bold rounded text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Loader2 v-if="isSavingRule" class="w-3.5 h-3.5 animate-spin" />
                        <Check v-else class="w-3.5 h-3.5 stroke-3" />
                        <span>Save Rule</span>
                      </button>
                    </div>
                  </div>
                
                <div v-if="!(!currentProject.billing_rules || currentProject.billing_rules.length === 0)" class="space-y-2">
                    <div
                      v-for="rule in currentProject.billing_rules"
                      :key="rule.id"
                      class="flex items-center justify-between gap-2 bg-[#161618] border border-[#333333] rounded-lg p-2.5 text-white"
                    >
                      <div class="flex items-center gap-2 min-w-0 flex-1">
                        <span class="font-bold text-white truncate">{{ rule.title }}</span>
                        <span class="text-[#888888]">
                          (Age {{ getOperatorDisplay(rule.age_operator) }} {{ rule.age_threshold }})
                        </span>
                      </div>

                      <div class="flex items-center gap-3 shrink-0">
                        <span class="font-mono font-bold text-white">
                          {{ rule.hourly_rate }} {{ rule.currency || '€' }}/h
                        </span>
                        <button
                          v-if="isOwner"
                          @click="handleDeleteRule(rule.id)"
                          class="text-[#888888] hover:text-red-400 transition-colors p-1 cursor-pointer"
                          title="Remove rule"
                        >
                          <Trash2 class="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Danger Zone Card (Owner only) -->
                <div v-if="isOwner" class="bg-red-950/20 p-4 rounded-lg space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-bold text-red-300">Delete Project</div>
                    </div>
                    <button
                      @click="handleDeleteCurrentProject"
                      class="p-3 bg-red-900/60 hover:bg-red-800 text-red-200 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 class="w-5 h-5" />
                    </button>
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
