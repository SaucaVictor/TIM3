<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSpace } from '@/composables/useSpace';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useProjects } from '@/composables/useProjects';
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
  Loader,
  Pencil,
  ChevronDown,
  X,
} from 'lucide-vue-next';
import type { Project, SpaceMember, TimeEntry, EntryStatus } from '@/types';

const route = useRoute();
const router = useRouter();
const { currentSpace, spaceMembers, fetchSpaceMembers, isOwner } = useSpace();
const { spaceTeamEntries, isLoadingEntries, fetchSpaceTeamEntries, patchEntryStatus } = useTimeEntries();
const { projects, fetchProjects } = useProjects();
const { exportEntriesToCsv, calculateProjectSummaries, calculateMemberSummaries } = useExportCsv();

const searchQuery = ref('');
const filterProject = ref('');
const filterMember = ref('');
const filterStatus = ref('');
const filterDateStart = ref('');
const filterDateEnd = ref('');

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

const displayLimit = ref(50);

async function handleStatusSelect(entry: TimeEntry, event: Event) {
  if (!isOwner.value) return;
  const target = event.target as HTMLSelectElement;
  const newStatus = target.value as EntryStatus;
  patchEntryStatus(entry.id, newStatus);
}

onMounted(async () => {
  if (currentSpace.value) {
    await Promise.all([
      fetchProjects(currentSpace.value.id),
      fetchSpaceMembers(currentSpace.value.id),
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
    filterStatus.value ||
    filterDateStart.value ||
    filterDateEnd.value
  );
});

function clearAllFilters() {
  searchQuery.value = '';
  filterProject.value = '';
  filterMember.value = '';
  filterStatus.value = '';
  filterDateStart.value = '';
  filterDateEnd.value = '';
}

const filteredTeamEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();

  return spaceTeamEntries.value.filter((e: TimeEntry) => {
    if (filterProject.value && e.project_id !== filterProject.value) return false;
    if (filterMember.value && e.user_id !== filterMember.value) return false;
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

function loadMoreEntries() {
  displayLimit.value += 50;
}
</script>

<template>
  <div class="space-y-4 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
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
          Entries
        </div>
        <div class="text-xl font-bold text-white truncate">
          {{ filteredTeamEntries.length }}
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

    <!-- Intuitive Filter Bar -->
    <div class="bg-[#252525] p-4 rounded-lg space-y-3 border border-[#333333]/50">
      <div class="flex items-center justify-between">
        <span class="font-bold text-white">Filters</span>
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
          placeholder="Search member, project, task, notes..."
          class="w-full h-11 bg-[#161618] text-white rounded-lg pl-10 pr-4 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666] transition-colors"
        />
      </div>

      <!-- Filter Controls Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <!-- Project Filter -->
        <select
          v-model="filterProject"
          class="h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Projects</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>

        <!-- Member Filter -->
        <select
          v-model="filterMember"
          class="h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Members</option>
          <option v-for="m in spaceMembers" :key="m.user_id" :value="m.user_id">
            {{ m.profiles?.full_name || m.profiles?.email || 'Member' }}
          </option>
        </select>

        <!-- Status Filter -->
        <select
          v-model="filterStatus"
          class="h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="awaiting">Awaiting Approval</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
        </select>

        <!-- Date Range -->
        <div class="flex items-center gap-2">
          <input
            v-model="filterDateStart"
            type="date"
            class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none"
          />
          <input
            v-model="filterDateEnd"
            type="date"
            class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none"
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
      <div class="px-4 py-3 border-b border-[#333333] flex items-center justify-between">
        <h3 class="font-bold text-white">
          All Tracked Time Entries
        </h3>
        <span class="font-bold text-[#888888]">{{ filteredTeamEntries.length }}</span>
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
            <tr v-for="entry in paginatedTeamEntries" :key="entry.id" class="hover:bg-[#1f1f21] transition-colors">
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
              <td class="px-4 py-3 whitespace-nowrap">
                <select
                  v-if="isOwner"
                  :value="entry.status || 'awaiting'"
                  @change="handleStatusSelect(entry, $event)"
                  class="bg-[#161618] border border-[#333333] rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-[#5bb8f5] transition-colors font-bold"
                  :class="entry.status === 'approved' || entry.status === 'paid' ? 'text-emerald-400' : 'text-[#888888]'"
                >
                  <option value="awaiting" class="text-[#888888] bg-[#1a1a1a]">Awaiting</option>
                  <option value="approved" class="text-emerald-400 bg-[#1a1a1a]">Approved</option>
                  <option value="paid" class="text-emerald-400 bg-[#1a1a1a]">Paid</option>
                </select>
                <div v-else class="inline-flex items-center gap-1.5">
                  <CheckCircle2 v-if="entry.status === 'approved'" class="w-5 h-5 text-emerald-400" />
                  <CircleDollarSign v-else-if="entry.status === 'paid'" class="w-5 h-5 text-emerald-400" />
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

        <!-- Load More Controller -->
        <div v-if="filteredTeamEntries.length > paginatedTeamEntries.length" class="p-4 border-t border-[#333333] text-center">
          <button
            @click="loadMoreEntries"
            class="h-11 px-6 font-bold text-white hover:text-[#5bb8f5] border border-[#333333] active:scale-95 bg-[#161618] hover:bg-[#202124] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <ChevronDown class="w-5 h-5" />
            <span>Show More</span>
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
  </div>
</template>
