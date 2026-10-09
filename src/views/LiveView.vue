<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSpace } from '@/composables/useSpace';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useProjects } from '@/composables/useProjects';
import { supabase } from '@/lib/supabase';
import {
  Radio,
  Clock,
  Folder,
  CheckSquare,
  FileText,
  Users,
  RefreshCw,
  ChevronDown,
} from 'lucide-vue-next';
import type { TimeEntry, Project } from '@/types';

const { currentSpace } = useSpace();
const { activeTimers, isLoadingActiveTimers, fetchActiveTimers } = useTimeEntries();
const { projects, fetchProjects } = useProjects();

const selectedProjectId = ref<string>('all');
const currentTime = ref(Date.now());
let timerInterval: any = null;
let realtimeChannel: any = null;

onMounted(async () => {
  if (currentSpace.value) {
    await Promise.all([
      fetchProjects(currentSpace.value.id),
      fetchActiveTimers(currentSpace.value.id),
    ]);
    setupRealtimeSubscription(currentSpace.value.id);
  }

  // Live ticker updates every second
  timerInterval = setInterval(() => {
    currentTime.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }
});

function setupRealtimeSubscription(spaceId: string) {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel(`live-timers-${spaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'time_entries',
        filter: `space_id=eq.${spaceId}`,
      },
      () => {
        fetchActiveTimers(spaceId);
      }
    )
    .subscribe();
}

async function handleRefresh() {
  if (currentSpace.value) {
    await fetchActiveTimers(currentSpace.value.id);
  }
}

// Compute live elapsed seconds for an entry
function getElapsedSeconds(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  const elapsedMs = Math.max(0, currentTime.value - start);
  return Math.floor(elapsedMs / 1000);
}

// Format seconds into HH:MM:SS
function formatLiveElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Format seconds into HH:MM:SS
function formatLiveElapsed2(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h)}h ${String(m)}m`;
  }
  return `${String(m)}m ${String(s)}s`;
}

const filteredActiveTimers = computed(() => {
  if (selectedProjectId.value === 'all') {
    return activeTimers.value;
  }
  return activeTimers.value.filter((e) => e.project_id === selectedProjectId.value);
});

// Count active per project
const projectActiveCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const entry of activeTimers.value) {
    counts[entry.project_id] = (counts[entry.project_id] || 0) + 1;
  }
  return counts;
});

const userInitials = (entry: TimeEntry) => {
  const name = entry.profiles?.full_name || entry.profiles?.email || '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};
</script>

<template>
  <div class="space-y-4 max-w-6xl mx-auto px-4 sm:px-6 pb-24">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 pt-2">
      <div class="flex items-center gap-2.5">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-white tracking-tight">
            Live
          </h1>
        </div>
      </div>

      <button
        @click="handleRefresh"
        :disabled="isLoadingActiveTimers"
        class="p-2 rounded-lg bg-[#161618] hover:bg-[#252525] text-[#b3b3b3] hover:text-white border border-[#333333] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
        title="Refresh"
      >
        <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': isLoadingActiveTimers }" />
      </button>
    </div>

    <!-- Project Filter Dropdown -->
    <div class="relative">
      <select
        v-model="selectedProjectId"
        class="w-full h-11 bg-[#161618] text-white border border-[#333333] rounded-lg px-3.5 pr-10 text-sm font-medium cursor-pointer appearance-none hover:border-[#444444] transition-colors"
      >
        <option value="all">
          All Projects ({{ activeTimers.length }})
        </option>
        <option
          v-for="proj in projects"
          :key="proj.id"
          :value="proj.id"
        >
          {{ proj.name }} {{ projectActiveCounts[proj.id] ? `(${projectActiveCounts[proj.id]} active)` : '' }}
        </option>
      </select>
      <ChevronDown class="w-4 h-4 text-[#888888] pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
    </div>

    <!-- Live Cards Grid -->
    <div v-if="filteredActiveTimers.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
      <div
        v-for="entry in filteredActiveTimers"
        :key="entry.id"
        class="relative overflow-hidden group flex justify-between max-w-full items-center"
      >
        <div class="flex items-center justify-between gap-3 relative z-10">
          <div class="flex items-center gap-3 min-w-0">
            <div
              v-if="entry.profiles?.avatar_url"
              class="w-10 h-10 rounded-full overflow-hidden bg-[#2a2a2d] border border-[#444444] shrink-0"
            >
              <img :src="entry.profiles.avatar_url" alt="" class="w-full h-full object-cover" />
            </div>
            <div
              v-else
              class="w-10 h-10 rounded-full bg-linear-to-br from-[#5bb8f5]/20 to-[#3b82f6]/20 border border-[#5bb8f5]/30 text-[#5bb8f5] font-bold flex items-center justify-center shrink-0 text-sm"
            >
              {{ userInitials(entry) }}
            </div>

            <div class="min-w-0">
              <h3 class="text-base font-bold text-white truncate">
                {{ entry.profiles?.full_name || entry.profiles?.email || 'Team Member' }}
              </h3>
              <div class="flex pt-0.5 items-center gap-2 text-xs">
                <Folder class="w-3.5 h-3.5 text-[#cfcfcf] shrink-0" />
                <span class="font-semibold text-/80 truncate">{{ entry.projects?.name || 'Project' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Timer Display (Big Prominent Font, No redundant label) -->
        <div class="shrink-0">
          <div class="text-white font-semibold text-sm">
            {{ formatLiveElapsed2(getElapsedSeconds(entry.started_at)) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!isLoadingActiveTimers"
      class="bg-[#1e1e20] border border-[#333333]/50 rounded-lg p-10 text-center space-y-3 max-w-sm mx-auto my-4"
    >
      <div class="space-y-1">
        <h3 class="text-base font-bold text-white">
          No active timers
        </h3>
      </div>
    </div>
  </div>
</template>
