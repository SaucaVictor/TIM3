<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSpace } from '@/composables/useSpace';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useProjects } from '@/composables/useProjects';
import { useTeams } from '@/composables/useTeams';
import { useExportCsv } from '@/composables/useExportCsv';
import TimeEntrySlideOver from '@/components/timer/TimeEntrySlideOver.vue';
import ProjectSlideOver from '@/components/projects/ProjectSlideOver.vue';
import {
  formatTimeHHMM,
  formatDateShort,
  formatDurationMinutes,
  calculateDurationMinutes,
} from '@/lib/utils';
import { calculateEntryEarnings } from '@/lib/billing';
import {
  Download,
  Search,
  CheckCircle2,
  CircleDollarSign,
  AlertCircle,
  Loader,
  Pencil,
  ChevronDown,
  X,
  Users2,
  ArrowUpDown,
  CheckCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-vue-next';
import type { Project, SpaceMember, TimeEntry, EntryStatus } from '@/types';

const route = useRoute();
const router = useRouter();
const { currentSpace, spaceMembers, fetchSpaceMembers, isOwner } = useSpace();
const {
  spaceTeamEntries,
  isLoadingEntries,
  isLoadingMoreTeamEntries,
  hasMoreTeamEntries,
  fetchSpaceTeamEntries,
  fetchAllSpaceTeamEntries,
  patchEntryStatus,
  bulkUpdateStatus,
} = useTimeEntries();
const { projects, fetchProjects } = useProjects();
const { teams, fetchTeams } = useTeams();
const { exportEntriesToCsv, calculateProjectSummaries, calculateMemberSummaries } = useExportCsv();

const searchQuery = ref('');
const filterProject = ref('');
const filterMember = ref('');
const filterTeam = ref('');
const filterStatus = ref('');
const filterDateStart = ref('');
const filterDateEnd = ref('');
const sortBy = ref<'date_desc' | 'date_asc' | 'duration_desc' | 'duration_asc' | 'member_asc'>('date_desc');

// Bulk selection state
const selectedEntryIds = ref<string[]>([]);
const isBulkActionLoading = ref(false);

// Slideover state for time entry editing
const isEntrySlideOverOpen = ref(false);
const selectedEntryForSlideOver = ref<TimeEntry | null>(null);

// Slideover state for project details
const isProjectSlideOverOpen = ref(false);
const selectedProjectIdForSlideOver = ref<string | null>(null);

function openEditEntrySlideOver(entry: TimeEntry) {
  selectedEntryForSlideOver.value = entry;
  isEntrySlideOverOpen.value = true;
}

function openProjectSlideOver(projectId: string) {
  selectedProjectIdForSlideOver.value = projectId;
  isProjectSlideOverOpen.value = true;
}

const displayLimit = ref(1000);

async function handleStatusSelect(entry: TimeEntry, event: Event) {
  if (!isOwner.value) return;
  const target = event.target as HTMLSelectElement;
  const newStatus = target.value as EntryStatus;
  await patchEntryStatus(entry.id, newStatus);
}

onMounted(async () => {
  if (currentSpace.value) {
    await Promise.all([
      fetchProjects(currentSpace.value.id),
      fetchSpaceMembers(currentSpace.value.id),
      fetchTeams(currentSpace.value.id),
      fetchSpaceTeamEntries(currentSpace.value.id, true),
    ]);

    if (route.query.project) {
      const targetId = route.query.project as string;
      selectedProjectIdForSlideOver.value = targetId;
      isProjectSlideOverOpen.value = true;
    }
  }
});

watch(
  () => route.query.project,
  (projId) => {
    if (projId && typeof projId === 'string') {
      selectedProjectIdForSlideOver.value = projId;
      isProjectSlideOverOpen.value = true;
    } else if (!projId && isProjectSlideOverOpen.value) {
      isProjectSlideOverOpen.value = false;
      selectedProjectIdForSlideOver.value = null;
    }
  }
);

const isAnyFilterActive = computed(() => {
  return Boolean(
    searchQuery.value.trim() ||
    filterProject.value ||
    filterMember.value ||
    filterTeam.value ||
    filterStatus.value ||
    filterDateStart.value ||
    filterDateEnd.value ||
    sortBy.value !== 'date_desc'
  );
});

function clearAllFilters() {
  searchQuery.value = '';
  filterProject.value = '';
  filterMember.value = '';
  filterTeam.value = '';
  filterStatus.value = '';
  filterDateStart.value = '';
  filterDateEnd.value = '';
  sortBy.value = 'date_desc';
  selectedEntryIds.value = [];
}

const filteredTeamEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();

  // Find team member IDs if team filter is set
  let teamMemberIds: string[] | null = null;
  if (filterTeam.value) {
    const selectedTeam = teams.value.find((t) => t.id === filterTeam.value);
    if (selectedTeam) {
      teamMemberIds = selectedTeam.member_ids;
    }
  }

  let list = spaceTeamEntries.value.filter((e: TimeEntry) => {
    if (filterProject.value && e.project_id !== filterProject.value) return false;
    if (filterMember.value && e.user_id !== filterMember.value) return false;
    if (teamMemberIds && !teamMemberIds.includes(e.user_id)) return false;

    if (filterStatus.value) {
      const status = e.status || 'awaiting';
      if (status !== filterStatus.value) return false;
    }
    if (filterDateStart.value) {
      const entryDate = e.started_at.split('T')[0];
      if (entryDate < filterDateStart.value) return false;
    }
    if (filterDateEnd.value) {
      const entryDate = e.started_at.split('T')[0];
      if (entryDate > filterDateEnd.value) return false;
    }

    if (q) {
      const memberName = e.profiles?.full_name?.toLowerCase() || e.profiles?.email?.toLowerCase() || '';
      const projName = e.projects?.name?.toLowerCase() || '';
      const taskName = e.tasks?.name?.toLowerCase() || '';
      const notes = e.notes?.toLowerCase() || '';
      const matches =
        memberName.includes(q) ||
        projName.includes(q) ||
        taskName.includes(q) ||
        notes.includes(q);
      if (!matches) return false;
    }

    return true;
  });

  // Sorting
  return list.sort((a, b) => {
    if (sortBy.value === 'date_desc') {
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    } else if (sortBy.value === 'date_asc') {
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    } else if (sortBy.value === 'duration_desc') {
      const durA = calculateDurationMinutes(a.started_at, a.ended_at);
      const durB = calculateDurationMinutes(b.started_at, b.ended_at);
      return durB - durA;
    } else if (sortBy.value === 'duration_asc') {
      const durA = calculateDurationMinutes(a.started_at, a.ended_at);
      const durB = calculateDurationMinutes(b.started_at, b.ended_at);
      return durA - durB;
    } else if (sortBy.value === 'member_asc') {
      const nameA = a.profiles?.full_name || a.profiles?.email || '';
      const nameB = b.profiles?.full_name || b.profiles?.email || '';
      return nameA.localeCompare(nameB);
    }
    return 0;
  });
});

const paginatedTeamEntries = computed(() => {
  return filteredTeamEntries.value.slice(0, displayLimit.value);
});

const totalMinutesTracked = computed(() => {
  return filteredTeamEntries.value.reduce((acc: number, e: TimeEntry) => {
    return acc + calculateDurationMinutes(e.started_at, e.ended_at);
  }, 0);
});

const totalEarningsCalculated = computed(() => {
  let total = 0;
  filteredTeamEntries.value.forEach((e) => {
    const { earnings } = calculateEntryEarnings(e, e.projects, e.profiles);
    total += earnings;
  });
  return Math.round(total * 100) / 100;
});

const projectSummaries = computed(() => calculateProjectSummaries(filteredTeamEntries.value));
const memberSummaries = computed(() => calculateMemberSummaries(filteredTeamEntries.value));

function handleExportCsv() {
  if (currentSpace.value) {
    exportEntriesToCsv(filteredTeamEntries.value, currentSpace.value.name);
  }
}

async function loadMoreEntries() {
  if (currentSpace.value && hasMoreTeamEntries.value) {
    await fetchSpaceTeamEntries(currentSpace.value.id, false);
  }
  displayLimit.value += 1000;
}

async function loadAllEntries() {
  if (currentSpace.value) {
    await fetchAllSpaceTeamEntries(currentSpace.value.id);
    displayLimit.value = spaceTeamEntries.value.length;
  }
}

// Bulk Selection Methods
const isAllFilteredSelected = computed(() => {
  if (paginatedTeamEntries.value.length === 0) return false;
  return paginatedTeamEntries.value.every((e) => selectedEntryIds.value.includes(e.id));
});

function toggleSelectAllFiltered() {
  if (isAllFilteredSelected.value) {
    const visibleIds = new Set(paginatedTeamEntries.value.map((e) => e.id));
    selectedEntryIds.value = selectedEntryIds.value.filter((id) => !visibleIds.has(id));
  } else {
    const union = new Set([...selectedEntryIds.value, ...paginatedTeamEntries.value.map((e) => e.id)]);
    selectedEntryIds.value = Array.from(union);
  }
}

function toggleSelectEntry(id: string) {
  const idx = selectedEntryIds.value.indexOf(id);
  if (idx === -1) {
    selectedEntryIds.value.push(id);
  } else {
    selectedEntryIds.value.splice(idx, 1);
  }
}

function selectByTeam(teamId: string) {
  const team = teams.value.find((t) => t.id === teamId);
  if (!team) return;

  const targetIds = filteredTeamEntries.value
    .filter((e) => team.member_ids.includes(e.user_id))
    .map((e) => e.id);

  const union = new Set([...selectedEntryIds.value, ...targetIds]);
  selectedEntryIds.value = Array.from(union);
}

// Selected entries stats
const selectedEntries = computed(() => {
  return spaceTeamEntries.value.filter((e) => selectedEntryIds.value.includes(e.id));
});

const selectedTotalMinutes = computed(() => {
  return selectedEntries.value.reduce((acc, e) => acc + calculateDurationMinutes(e.started_at, e.ended_at), 0);
});

const selectedTotalAmount = computed(() => {
  let total = 0;
  selectedEntries.value.forEach((e) => {
    const { earnings } = calculateEntryEarnings(e, e.projects, e.profiles);
    total += earnings;
  });
  return Math.round(total * 100) / 100;
});

async function handleBulkStatusChange(status: EntryStatus) {
  if (selectedEntryIds.value.length === 0 || !isOwner.value) return;

  isBulkActionLoading.value = true;
  try {
    await bulkUpdateStatus(selectedEntryIds.value, status);
  } finally {
    isBulkActionLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-4 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-36">
    <!-- Header & Export Button -->
    <div class="flex items-center justify-between gap-4 pt-2">
      <h1 class="text-2xl font-bold text-white">
        Dashboard
      </h1>

      <button
        :disabled="filteredTeamEntries.length === 0"
        @click="handleExportCsv"
        class="h-10 px-4 font-bold text-white hover:text-[#5bb8f5] border border-[#333333] active:scale-95 bg-[#161618] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Download class="w-5 h-5" />
        <span class="hidden sm:inline">Export CSV</span>
      </button>
    </div>

    <!-- KPI Overview Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-[#252525] p-4 rounded-lg space-y-1 border border-[#333333]/50">
        <div class="font-bold text-[#888888]">
          Total Time
        </div>
        <div class="text-xl font-bold text-white truncate">
          {{ formatDurationMinutes(totalMinutesTracked) }}
        </div>
      </div>

      <div class="bg-[#252525] p-4 rounded-lg space-y-1 border border-[#333333]/50">
        <div class="font-bold text-[#888888]">
          Total Amount
        </div>
        <div class="text-xl font-bold text-emerald-400 font-mono truncate">
          € {{ totalEarningsCalculated.toFixed(2) }}
        </div>
      </div>

      <div class="bg-[#252525] p-4 rounded-lg space-y-1 border border-[#333333]/50">
        <div class="font-bold text-[#888888]">
          Entries Loaded
        </div>
        <div class="text-xl font-bold text-white truncate flex items-center gap-2">
          <span>{{ filteredTeamEntries.length }}</span>
          <span v-if="hasMoreTeamEntries" class="text-xs text-[#5bb8f5] font-normal">
            (+ more in cloud)
          </span>
        </div>
      </div>

      <div class="bg-[#252525] p-4 rounded-lg space-y-1 border border-[#333333]/50">
        <div class="font-bold text-[#888888]">
          Projects
        </div>
        <div class="text-xl font-bold text-white truncate">
          {{ projectSummaries.length }}
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="bg-[#252525] p-4 rounded-lg space-y-3 border border-[#333333]/50">
      <div class="flex items-center justify-between">
        <span class="font-bold text-white">Filters & Sorting</span>
        <button
          v-if="isAnyFilterActive"
          @click="clearAllFilters"
          class="font-bold text-[#5bb8f5] hover:text-[#7ac0e3] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
          <span>Reset</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-full">
        <Search class="w-5 h-5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by member, project, task, or notes..."
          class="w-full bg-[#161618] text-white border border-[#333333] rounded-lg pl-10 pr-4 py-2.5 focus:border-[#5bb8f5] focus:outline-none"
        />
      </div>

      <!-- Filters & Sort Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- Project Filter -->
        <select
          v-model="filterProject"
          class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Projects</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <!-- Member Filter -->
        <select
          v-model="filterMember"
          class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Members</option>
          <option v-for="m in spaceMembers" :key="m.user_id" :value="m.user_id">
            {{ m.profiles?.full_name || m.profiles?.email }}
          </option>
        </select>

        <!-- Team / Group Filter -->
        <select
          v-model="filterTeam"
          class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Teams / Groups</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">
            Team: {{ t.name }}
          </option>
        </select>

        <!-- Status Filter with Not Paid -->
        <select
          v-model="filterStatus"
          class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="awaiting">Awaiting Approval</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="not_paid">Not paid</option>
        </select>

        <!-- Sort Option (By Hours / Days / Name) -->
        <select
          v-model="sortBy"
          class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="date_desc">Date: Newest First</option>
          <option value="date_asc">Date: Oldest First</option>
          <option value="duration_desc">Hours: Highest First</option>
          <option value="duration_asc">Hours: Lowest First</option>
          <option value="member_asc">Member: Name A-Z</option>
        </select>

        <!-- Date Range -->
        <div class="flex items-center gap-1.5">
          <input
            v-model="filterDateStart"
            type="date"
            class="w-1/2 h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-2 text-xs focus:border-[#5bb8f5] focus:outline-none"
            title="Start date"
          />
          <input
            v-model="filterDateEnd"
            type="date"
            class="w-1/2 h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-2 text-xs focus:border-[#5bb8f5] focus:outline-none"
            title="End date"
          />
        </div>
      </div>
    </div>

    <!-- Summaries Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Projects Summary -->
      <div class="bg-[#252525] p-4 rounded-lg space-y-3 border border-[#333333]/50">
        <div class="flex items-center justify-between pb-2 border-b border-[#333333]">
          <span class="font-bold text-white">Projects Breakdown</span>
          <span class="text-[#888888] font-bold">{{ projectSummaries.length }}</span>
        </div>

        <div v-if="projectSummaries.length === 0" class="py-6 text-center text-[#888888]">
          No project time recorded.
        </div>

        <div v-else class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          <div
            v-for="p in projectSummaries"
            :key="p.projectId"
            @click="p.projectId !== 'unassigned' && openProjectSlideOver(p.projectId)"
            class="flex items-center justify-between p-3 bg-[#161618] hover:bg-[#1f1f21] rounded-lg border border-[#333333]/50 cursor-pointer transition-colors"
          >
            <span class="font-bold text-white hover:text-[#5bb8f5] truncate">{{ p.projectName }}</span>
            <span class="font-mono font-bold text-white">
              {{ formatDurationMinutes(p.totalMinutes) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Members Summary -->
      <div class="bg-[#252525] p-4 rounded-lg space-y-3 border border-[#333333]/50">
        <div class="flex items-center justify-between pb-2 border-b border-[#333333]">
          <span class="font-bold text-white">Members Breakdown</span>
          <span class="text-[#888888] font-bold">{{ memberSummaries.length }}</span>
        </div>

        <div v-if="memberSummaries.length === 0" class="py-6 text-center text-[#888888]">
          No member time recorded.
        </div>

        <div v-else class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          <div
            v-for="m in memberSummaries"
            :key="m.userId"
            class="flex items-center justify-between p-3 bg-[#161618] rounded-lg border border-[#333333]/50"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#333333] text-white font-bold flex items-center justify-center uppercase shrink-0">
                {{ m.userName.charAt(0) }}
              </div>
              <span class="font-bold text-white truncate">{{ m.userName }}</span>
            </div>
            <span class="font-mono font-bold text-white">
              {{ formatDurationMinutes(m.totalMinutes) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Time Entries Log Table -->
    <div class="bg-[#252525] rounded-lg border border-[#333333]/50 overflow-hidden">
      <!-- Table Header & Quick Team Selector -->
      <div class="px-4 py-3 border-b border-[#333333] flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <h3 class="font-bold text-white">
            All Tracked Time Entries
          </h3>
          <span class="text-xs px-2 py-0.5 rounded-full bg-[#161618] text-[#888888] font-mono">
            Showing {{ paginatedTeamEntries.length }} of {{ filteredTeamEntries.length }}
          </span>
        </div>

        <!-- Quick "Select by Team" actions for bulk approval -->
        <div v-if="isOwner && teams.length > 0" class="flex items-center gap-2">
          <span class="text-xs text-[#888888] hidden sm:inline">Select group:</span>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-for="team in teams"
              :key="team.id"
              @click="selectByTeam(team.id)"
              class="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#161618] hover:bg-[#202023] text-[#5bb8f5] border border-[#333333] transition-colors cursor-pointer"
              :title="`Select all entries by members of ${team.name}`"
            >
              + {{ team.name }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="isLoadingEntries" class="py-12 text-center text-[#888888]">
        Loading team entries...
      </div>

      <div v-else-if="filteredTeamEntries.length === 0" class="py-12 text-center text-[#888888]">
        No time entries match the selected filters.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-[#161618] border-b border-[#333333] text-[#888888] font-bold">
            <tr>
              <th v-if="isOwner" class="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  :checked="isAllFilteredSelected"
                  @change="toggleSelectAllFiltered"
                  class="rounded w-4 h-4 border-[#444444] text-[#5bb8f5] focus:ring-0 cursor-pointer"
                  title="Select / deselect all visible"
                />
              </th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Member</th>
              <th class="px-4 py-3">Project</th>
              <th class="px-4 py-3">Task</th>
              <th class="px-4 py-3">Start</th>
              <th class="px-4 py-3">End</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Duration</th>
              <th v-if="isOwner" class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#333333]/40">
            <tr
              v-for="entry in paginatedTeamEntries"
              :key="entry.id"
              class="hover:bg-[#1f1f21] transition-colors"
              :class="{ 'bg-[#1b2530]/50': selectedEntryIds.includes(entry.id) }"
            >
              <!-- Checkbox for Bulk Selection -->
              <td v-if="isOwner" class="px-3 py-3">
                <input
                  type="checkbox"
                  :checked="selectedEntryIds.includes(entry.id)"
                  @click.stop="toggleSelectEntry(entry.id)"
                  class="rounded w-4 h-4 border-[#444444] text-[#5bb8f5] cursor-pointer"
                />
              </td>

              <td class="px-4 py-3 font-mono text-neutral-200 font-bold whitespace-nowrap">
                {{ formatDateShort(entry.started_at) }}
              </td>

              <td class="px-4 py-3 text-white font-medium">
                {{ entry.profiles?.full_name || 'Member' }}
              </td>

              <td class="px-4 py-3 font-bold whitespace-nowrap">
                <button
                  v-if="entry.project_id"
                  @click="openProjectSlideOver(entry.project_id)"
                  class="text-white hover:text-[#5bb8f5] transition-colors cursor-pointer text-left"
                >
                  {{ entry.projects?.name || 'Project' }}
                </button>
                <span v-else class="text-[#888888]">Unassigned</span>
              </td>

              <td class="px-4 py-3 text-[#888888]">
                {{ entry.tasks?.name || '-' }}
              </td>

              <td class="px-4 py-3 font-mono text-[#888888]">
                {{ formatTimeHHMM(entry.started_at) }}
              </td>

              <td class="px-4 py-3 font-mono text-[#888888]">
                {{ entry.ended_at ? formatTimeHHMM(entry.ended_at) : 'Active' }}
              </td>

              <!-- Status with Not Paid & Red Icon -->
              <td class="px-4 py-3 whitespace-nowrap">
                <select
                  v-if="isOwner"
                  :value="entry.status || 'awaiting'"
                  @change="handleStatusSelect(entry, $event)"
                  class="bg-[#161618] border border-[#333333] rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-[#5bb8f5] transition-colors font-bold"
                  :class="
                    entry.status === 'approved' || entry.status === 'paid'
                      ? 'text-emerald-400'
                      : entry.status === 'not_paid'
                      ? 'text-rose-400 border-rose-500/40'
                      : 'text-[#888888]'
                  "
                >
                  <option value="awaiting" class="text-[#888888] bg-[#1a1a1a]">Awaiting</option>
                  <option value="approved" class="text-emerald-400 bg-[#1a1a1a]">Approved</option>
                  <option value="paid" class="text-emerald-400 bg-[#1a1a1a]">Paid</option>
                  <option value="not_paid" class="text-rose-400 bg-[#1a1a1a]">Not paid</option>
                </select>

                <div v-else class="inline-flex items-center gap-1.5">
                  <CheckCircle2 v-if="entry.status === 'approved'" class="w-5 h-5 text-emerald-400" />
                  <CircleDollarSign v-else-if="entry.status === 'paid'" class="w-5 h-5 text-emerald-400" />
                  <AlertCircle v-else-if="entry.status === 'not_paid'" class="w-5 h-5 text-rose-400" />
                  <Loader v-else class="w-5 h-5 text-[#888888]" />
                </div>
              </td>

              <td class="px-4 py-3 font-mono font-bold text-white text-right">
                {{ formatDurationMinutes(calculateDurationMinutes(entry.started_at, entry.ended_at)) }}
              </td>

              <td v-if="isOwner" class="px-4 py-3 text-right">
                <button
                  @click="openEditEntrySlideOver(entry)"
                  class="p-2 rounded-lg transition-colors cursor-pointer hover:bg-[#333333] inline-flex items-center justify-center text-[#888888] hover:text-white"
                  title="Edit entry"
                >
                  <Pencil class="w-5 h-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Load More Controller (Fixed: fetches next batches from Supabase!) -->
        <div
          v-if="filteredTeamEntries.length > paginatedTeamEntries.length || hasMoreTeamEntries"
          class="p-4 border-t border-[#333333] flex flex-wrap items-center justify-center gap-3"
        >
          <button
            @click="loadMoreEntries"
            :disabled="isLoadingMoreTeamEntries"
            class="h-11 px-6 font-bold text-white hover:text-[#5bb8f5] border border-[#333333] active:scale-95 bg-[#161618] hover:bg-[#202124] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
          >
            <ChevronDown class="w-5 h-5" :class="{ 'animate-spin': isLoadingMoreTeamEntries }" />
            <span>{{ isLoadingMoreTeamEntries ? 'Loading more...' : 'Load More Entries' }}</span>
          </button>

          <button
            v-if="hasMoreTeamEntries"
            @click="loadAllEntries"
            :disabled="isLoadingMoreTeamEntries"
            class="h-11 px-5 font-semibold text-xs text-[#888888] hover:text-white border border-[#333333]/50 hover:border-[#444444] bg-[#161618]/50 hover:bg-[#202124] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw class="w-4 h-4" />
            <span>Load All Available Entries</span>
          </button>
        </div>
      </div>
    </div>

    <!-- TimeEntry SlideOver for editing entries -->
    <TimeEntrySlideOver
      :is-open="isEntrySlideOverOpen"
      :entry="selectedEntryForSlideOver"
      @close="isEntrySlideOverOpen = false; selectedEntryForSlideOver = null;"
    />

    <!-- Project SlideOver for viewing and configuring project stats/tasks/settings -->
    <ProjectSlideOver
      :is-open="isProjectSlideOverOpen"
      :project-id="selectedProjectIdForSlideOver"
      @close="isProjectSlideOverOpen = false; selectedProjectIdForSlideOver = null;"
    />
    <!-- Floating Bottom Bulk Action Toolbar -->
    <Transition
      enter-active-class="transition-all duration-100 ease-out"
      enter-from-class="opacity-0 translate-y-10 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-10 scale-95"
    >
      <div
        v-if="isOwner && selectedEntryIds.length > 0"
        class="fixed bottom-3 sm:bottom-6 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-50 bg-[#161618]/95 backdrop-blur-xl border border-[#3b3b40]/90 rounded-lg p-2.5 sm:p-3 shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex flex-col sm:flex-row items-center justify-between gap-2"
      >
        <div class="flex items-center justify-between w-full sm:w-auto gap-2 px-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-white text-xs sm:text-sm whitespace-nowrap">
              {{ selectedEntryIds.length }} selected
            </span>
            <span class="text-xs whitespace-nowrap">
              ({{ formatDurationMinutes(selectedTotalMinutes) }} • €{{ selectedTotalAmount.toFixed(2) }})
            </span>
          </div>

          <!-- Mobile Clear button -->
          <button
            @click="selectedEntryIds = []"
            class="sm:hidden p-1 text-[#888888] hover:text-white cursor-pointer"
            title="Clear selection"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex items-center gap-1.5 w-full sm:w-auto justify-end">
          <button
            @click="handleBulkStatusChange('awaiting')"
            :disabled="isBulkActionLoading"
            class="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-[#161618] text-white border border-[#888888]/50 hover:border-[#444444] bg-[#161618]/50 hover:bg-[#202124] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-w-0"
          >
            <Loader class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">Awaiting</span>
          </button>

          <button
            @click="handleBulkStatusChange('approved')"
            :disabled="isBulkActionLoading"
            class="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-w-0"
          >
            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span class="truncate">Approve</span>
          </button>

          <button
            @click="handleBulkStatusChange('paid')"
            :disabled="isBulkActionLoading"
            class="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-w-0"
          >
            <CircleDollarSign class="w-3.5 h-3.5 shrink-0" />
            <span class="truncate">Paid</span>
          </button>

          <button
            @click="handleBulkStatusChange('not_paid')"
            :disabled="isBulkActionLoading"
            class="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 min-w-0"
          >
            <AlertCircle class="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span class="truncate">Not Paid</span>
          </button>

          <button
            @click="selectedEntryIds = []"
            class="hidden sm:inline-flex px-3 py-2 rounded-xl bg-[#252525] hover:bg-[#303030] text-[#888888] hover:text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
