<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSpace } from '@/composables/useSpace';
import { useProjects } from '@/composables/useProjects';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useAuth } from '@/composables/useAuth';
import { calculateEntryEarnings } from '@/lib/billing';
import { calculateDurationSeconds } from '@/lib/utils';
import ProjectSlideOver from '@/components/projects/ProjectSlideOver.vue';
import {
  Plus,
  Search,
  Loader2,
  Folder,
} from 'lucide-vue-next';
import type { Project } from '@/types';

const route = useRoute();
const router = useRouter();
const { profile } = useAuth();
const { currentSpace, isOwner, spaceMembers, fetchSpaceMembers } = useSpace();
const {
  projects,
  isLoadingProjects,
  projectError,
  fetchProjects,
  createProject,
} = useProjects();
const { spaceTeamEntries, userEntries, fetchSpaceTeamEntries, fetchUserEntries } = useTimeEntries();

const searchQuery = ref('');
const newProjectName = ref('');
const isCreating = ref(false);

// SlideOver state
const selectedProjectId = ref<string | null>(null);
const isSlideOverOpen = ref(false);

onMounted(async () => {
  if (currentSpace.value) {
    await Promise.all([
      fetchProjects(currentSpace.value.id),
      fetchSpaceMembers(currentSpace.value.id),
      isOwner.value ? fetchSpaceTeamEntries(currentSpace.value.id) : fetchUserEntries(currentSpace.value.id),
    ]);

    if (route.query.project) {
      const targetId = route.query.project as string;
      if (projects.value.some((p) => p.id === targetId)) {
        selectedProjectId.value = targetId;
        isSlideOverOpen.value = true;
      }
    }
  }
});

watch(
  () => route.query.project,
  (projId) => {
    if (projId && typeof projId === 'string') {
      selectedProjectId.value = projId;
      isSlideOverOpen.value = true;
    } else if (!projId && isSlideOverOpen.value) {
      isSlideOverOpen.value = false;
      selectedProjectId.value = null;
    }
  }
);

function openProjectDetails(project: Project) {
  selectedProjectId.value = project.id;
  isSlideOverOpen.value = true;
}

function handleCloseSlideOver() {
  isSlideOverOpen.value = false;
  selectedProjectId.value = null;
}

async function handleCreateProject() {
  if (!newProjectName.value.trim() || isCreating.value) return;
  isCreating.value = true;
  const created = await createProject(newProjectName.value.trim());
  isCreating.value = false;
  if (created) {
    newProjectName.value = '';
    openProjectDetails(created);
  }
}

const filteredProjects = computed(() => {
  let list = [...projects.value].reverse();
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;

  return list.filter((p) => {
    const matchName = p.name.toLowerCase().includes(q);
    const responsibleName =
      p.responsible_profile?.full_name?.toLowerCase() ||
      p.responsible_profile?.email?.toLowerCase() ||
      getMemberName(p.responsible_user_id)?.toLowerCase() ||
      '';
    const matchResponsible = responsibleName.includes(q);
    return matchName || matchResponsible;
  });
});

function getMemberName(userId?: string | null): string | null {
  if (!userId) return null;
  const m = spaceMembers.value.find((sm) => sm.user_id === userId);
  return m?.profiles?.full_name || m?.profiles?.email || null;
}

const projectStatsMap = computed(() => {
  const map = new Map<string, { totalSeconds: number; totalEarnings: number; entriesCount: number }>();
  const entries = isOwner.value ? spaceTeamEntries.value : userEntries.value;

  entries.forEach((entry) => {
    if (!entry.project_id || !entry.started_at) return;
    const proj = projects.value.find((p) => p.id === entry.project_id);
    const prof = entry.profiles || (entry.user_id === profile.value?.id ? profile.value : null);
    const { earnings } = calculateEntryEarnings(entry, proj, prof);
    const seconds = calculateDurationSeconds(entry.started_at, entry.ended_at);

    let stat = map.get(entry.project_id);
    if (!stat) {
      stat = { totalSeconds: 0, totalEarnings: 0, entriesCount: 0 };
      map.set(entry.project_id, stat);
    }
    stat.totalSeconds += seconds;
    stat.totalEarnings += earnings;
    stat.entriesCount += 1;
  });

  return map;
});

function formatHHMMSS(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
</script>

<template>
  <div class="app max-w-3xl mx-auto px-4 sm:px-6 space-y-4" style="padding-bottom: calc(7rem + env(safe-area-inset-bottom));">
    <!-- Heading matching TimerView style -->
    <div class="flex justify-between items-baseline pt-2">
      <span class="text-lg font-bold text-white">Projects</span>
      <span class="text-lg font-semibold text-white">{{ projects.length }}</span>
    </div>

    <!-- Error notice -->
    <div v-if="projectError" class="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg">
      {{ projectError }}
    </div>

    <!-- Quick Add Project & Search -->
    <div class="flex flex-col gap-3 pb-2">
      <div class="sm:col-span-8 rounded-lg flex items-center gap-2">
        <input
          v-model="newProjectName"
          type="text"
          placeholder="New project name..."
          @keyup.enter="handleCreateProject"
          class="flex-1 h-10 bg-[#161618] text-white rounded-lg px-3.5 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666] transition-colors"
        />
        <button
          @click="handleCreateProject"
          :disabled="isCreating || !newProjectName.trim()"
          class="h-10 px-4 bg-[#5bb8f5] hover:bg-[#7ac0e3] active:scale-95 text-black font-bold rounded-lg transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="isCreating" class="w-4 h-4 animate-spin text-black" />
          <Plus v-else class="w-4 h-4 text-black stroke-3" />
          <span class="font-bold hidden sm:inline">Add</span>
        </button>
      </div>

      <div class="relative w-full">
        <Search class="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search projects..."
          class="w-full h-10 bg-[#161618] text-white rounded-lg pl-9 pr-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666] transition-colors"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingProjects && projects.length === 0" class="space-y-3">
      <div v-for="i in 3" :key="i" class="bg-[#252525] border border-[#252525] roundedlg px-4 py-4 animate-pulse">
        <div class="flex justify-between items-center gap-4">
          <div class="space-y-2.5 flex-1">
            <div class="h-5 w-36 bg-[#404040] rounded-md"></div>
            <div class="h-4 w-24 bg-[#333333] rounded-md"></div>
          </div>
          <div class="h-5 w-16 bg-[#404040] rounded-md"></div>
        </div>
      </div>
    </div>

    <!-- Empty Projects State -->
    <div
      v-else-if="filteredProjects.length === 0"
      class="py-10 bg-[#252525] border border-[#262930] rounded-lg text-center space-y-3 p-6"
    >
      <Folder class="w-10 h-10 text-[#888888] mx-auto" />
      <div class="text-base font-bold text-white">
        {{ searchQuery ? 'No matching projects' : 'No projects found' }}
      </div>
    </div>

    <!-- Projects List: Identical to TimerView.vue time entries -->
    <div v-else class="space-y-3">
      <article
        v-for="project in filteredProjects"
        :key="project.id"
        @click="openProjectDetails(project)"
        class="bg-[#252525] border border-[#252525] hover:border-[#5bb8f5]/40 rounded-lg px-4 py-4 transition-all hover:bg-[#2c2c2c] active:scale-[0.98] cursor-pointer shadow-lg"
      >
        <div class="flex justify-between items-center gap-4">
          <!-- Left Column -->
          <div class="flex-1 min-w-0">
            <span class="text-lg font-bold text-white truncate block">
              {{ project.name }}
            </span>
            <span
              v-if="project.responsible_profile?.full_name || getMemberName(project.responsible_user_id)"
              class="text-sm text-white font-medium truncate block"
            >
              {{ project.responsible_profile?.full_name || getMemberName(project.responsible_user_id) }}
            </span>
          </div>

          <!-- Right Column -->
          <div class="shrink-0 text-right">
            <span class="text-lg font-semibold text-white">
              {{ formatHHMMSS(projectStatsMap.get(project.id)?.totalSeconds || 0) }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <!-- Project Details Slide-Over Window -->
    <ProjectSlideOver
      :is-open="isSlideOverOpen"
      :project-id="selectedProjectId"
      @close="handleCloseSlideOver"
    />
  </div>
</template>
