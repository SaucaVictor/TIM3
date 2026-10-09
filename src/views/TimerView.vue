<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useSpace } from '@/composables/useSpace';
import { useTimer } from '@/composables/useTimer';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useProjects } from '@/composables/useProjects';
import ActiveTimerCard from '@/components/timer/ActiveTimerCard.vue';
import TimeEntrySlideOver from '@/components/timer/TimeEntrySlideOver.vue';
import { formatDateShort, calculateDurationSeconds } from '@/lib/utils';
import type { TimeEntry, Project } from '@/types';
import { Play, Plus, Keyboard, Clock, CheckCircle2, CircleDollarSign, AlertCircle, Loader, Loader2, Folder } from 'lucide-vue-next';

const { currentSpace } = useSpace();
const { isTimerRunning, checkActiveTimer, startTimer } = useTimer();
const { userEntries, isLoadingEntries, isLoadingMoreUserEntries, hasMoreUserEntries, fetchUserEntries } = useTimeEntries();
const { projects, fetchProjects, createProject } = useProjects();

const isFabMenuOpen = ref(false);
const isSlideOverOpen = ref(false);
const selectedEntryForSlideOver = ref<TimeEntry | null>(null);

const selectedQuickProjectId = ref('');
const selectedFabProjectId = ref('');

function handleScroll() {
  if (isLoadingEntries.value || isLoadingMoreUserEntries.value || !hasMoreUserEntries.value) return;
  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.documentElement.scrollHeight - 400;
  if (scrollPosition >= threshold) {
    fetchUserEntries(undefined, false);
  }
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true });
  if (currentSpace.value) {
    await checkActiveTimer(currentSpace.value.id);
    await fetchProjects(currentSpace.value.id);
    await fetchUserEntries(currentSpace.value.id, true);
    if (projects.value.length > 0) {
      selectedQuickProjectId.value = projects.value[0].id;
      selectedFabProjectId.value = projects.value[0].id;
    }
  }
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});

watch(
  () => projects.value,
  (newProjs: Project[]) => {
    if (newProjs.length > 0 && !selectedFabProjectId.value) {
      selectedFabProjectId.value = newProjs[0].id;
    }
  },
  { immediate: true }
);

// Group entries by date / week
const groupedEntries = computed(() => {
  const groups: Record<string, { entries: TimeEntry[]; totalSeconds: number }> = {};

  userEntries.value.forEach((entry) => {
    const dateKey = entry.started_at ? entry.started_at.split('T')[0] : 'Earlier';
    if (!groups[dateKey]) {
      groups[dateKey] = { entries: [], totalSeconds: 0 };
    }
    groups[dateKey].entries.push(entry);
    groups[dateKey].totalSeconds += calculateDurationSeconds(entry.started_at, entry.ended_at);
  });

  return groups;
});

function formatHHMMSS(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Tasteful project color palette (#4caf50 green, #7c8fdb purple, #5bb8f5 cyan)
function getProjectColor(index: number): string {
  const colors = ['#4caf50', '#7c8fdb', '#5bb8f5'];
  return colors[index % colors.length];
}

async function handleQuickStartTimer(projectId: string, taskId?: string | null, notes?: string) {
  if (!projectId) return;
  const success = await startTimer(projectId, taskId || null, notes || '');
  if (!success) {
    isFabMenuOpen.value = false;
    return;
  }
  isFabMenuOpen.value = false;
}

async function handleStartTimerFromFab() {
  let targetId = selectedFabProjectId.value;
  if (!targetId) {
    if (projects.value.length === 0) {
      const newP = await createProject('Default Project');
      if (newP) {
        targetId = newP.id;
        selectedFabProjectId.value = newP.id;
      }
    } else {
      targetId = projects.value[0].id;
      selectedFabProjectId.value = targetId;
    }
  }

  if (targetId) {
    await startTimer(targetId);
  }
  isFabMenuOpen.value = false;
}

function openEditSlideOver(entry: TimeEntry) {
  selectedEntryForSlideOver.value = entry;
  isSlideOverOpen.value = true;
}

function openNewManualSlideOver() {
  selectedEntryForSlideOver.value = null;
  isSlideOverOpen.value = true;
  isFabMenuOpen.value = false;
}
</script>

<template>
  <div class="app max-w-3xl mx-auto px-4 sm:px-6 space-y-6" style="padding-bottom: calc(7rem + env(safe-area-inset-bottom));">
    <!-- Active Timer Banner (If Running) -->
    <div v-if="isTimerRunning">
      <ActiveTimerCard />
    </div>

    <!-- Main Tracked Entries List View -->
    <div class="space-y-6">
      <Transition name="fade" mode="out-in">
        <!-- Loading Skeleton Cards State -->
        <div v-if="isLoadingEntries" key="loading" class="space-y-3">
          <div class="flex justify-between items-center pt-2 pb-1">
            <div class="h-5 w-28 bg-[#333333] rounded-md animate-pulse"></div>
            <div class="h-5 w-20 bg-[#333333] rounded-md animate-pulse"></div>
          </div>

          <div v-for="i in 3" :key="i" class="bg-[#252525] border border-[#333333] rounded-xl px-4 py-4 animate-pulse">
            <div class="flex justify-between items-stretch gap-4">
              <div class="space-y-2.5 flex-1">
                <div class="h-5 w-36 bg-[#404040] rounded-md"></div>
                <div class="h-4 w-24 bg-[#333333] rounded-md"></div>
                <div class="h-3.5 w-48 bg-[#2d2d2d] rounded-md"></div>
              </div>
              <div class="flex flex-col justify-between items-end self-stretch">
                <div class="h-5 w-16 bg-[#404040] rounded-md"></div>
                <div class="h-5 w-5 bg-[#404040] rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="userEntries.length === 0"
          key="empty"
          class="py-10 mt-4 bg-[#252525] border border-[#262930] rounded-xl text-center space-y-3 p-6"
        >
          <Clock class="w-10 h-10 text-[#888888] mx-auto" />
          <div class="text-base font-bold text-white">No time entries recorded</div>
          <p class="text-xs text-[#888888] max-w-xs mx-auto">
            Tap the <span class="text-[#5bb8f5] font-bold px-1">+</span> button to start tracking time.
          </p>
        </div>

        <!-- Grouped Time Entries Stack -->
        <div v-else key="content" class="space-y-6">
          <section v-for="(group, dateStr) in groupedEntries" :key="dateStr" class="space-y-2">
            <!-- Week Heading / Total -->
            <div class="flex justify-between items-baseline pt-2 pb-1">
              <span class="text-lg font-bold text-white">{{ formatDateShort(dateStr) }}</span>
              <span class="text-lg font-semibold text-white">{{ formatHHMMSS(group.totalSeconds) }}</span>
            </div>

            <!-- Task Cards Stack -->
            <div class="space-y-3">
              <article
                v-for="(entry, idx) in group.entries"
                :key="entry.id"
                @click="openEditSlideOver(entry)"
                class="bg-[#252525] border border-[#252525] hover:border-[#5bb8f5]/40 rounded-xl px-4 py-4 transition-all hover:bg-[#2c2c2c] active:scale-[0.98] cursor-pointer shadow-lg"
              >
                <div class="flex justify-between items-stretch gap-4">
                  <div class="flex flex-col justify-start flex-1 min-w-0 gap-0">
                    <div class="min-w-0">
                      <span class="text-lg font-bold truncate block leading-n" :class="{ 'italic opacity-50' : !entry.projects?.name }" :style="{ color: getProjectColor(idx) }">
                        {{ entry.projects?.name || 'no project' }}
                      </span>
                      <span v-if="entry.tasks?.name" class="text-sm text-white font-medium truncate block" :class="{ 'italic opacity-50' : !entry.tasks?.name }">
                        {{ entry.tasks?.name || '' }}
                      </span>
                    </div>
                    <p v-if="entry.notes" class="text-[#acacac] text-sm font-medium leading-relaxed truncate">
                      {{ entry.notes }}
                    </p>
                  </div>

                  <div class="flex flex-col justify-between items-end shrink-0 self-stretch gap-1">
                    <div class="flex items-center gap-2">
                      <!-- Status Icon (Simple icon, no background or borders) -->
                      <template v-if="entry.status === 'approved'">
                        <CheckCircle2 class="w-4 h-4 text-emerald-400" title="Approved" />
                      </template>
                      <template v-else-if="entry.status === 'paid'">
                        <CircleDollarSign class="w-4 h-4 text-emerald-400" title="Paid" />
                      </template>
                      <template v-else-if="entry.status === 'not_paid'">
                        <AlertCircle class="w-4 h-4 text-rose-400" title="Not Paid" />
                      </template>
                      <template v-else>
                        <Loader class="w-4 h-4 text-[#888888]" title="Awaiting Approval" />
                      </template>

                      <span class="text-white font-semibold">
                        {{ formatHHMMSS(calculateDurationSeconds(entry.started_at, entry.ended_at)) }}
                      </span>
                    </div>

                    <button
                      @click.stop="handleQuickStartTimer(entry.project_id, entry.task_id, entry.notes || '')"
                      class="text-[#888888] rounded-full p-2 -mr-2 -mb-2 hover:text-[#5bb8f5] hover:border-[#5bb8f5]/40 active:scale-90 transition-all cursor-pointer"
                      title="Continue this timer"
                    >
                      <Play class="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <!-- Infinite Scroll Loader Indicator -->
          <div v-if="isLoadingMoreUserEntries" class="py-4 text-center text-xs text-[#888888] flex items-center justify-center gap-2">
            <Loader2 class="w-4 h-4 animate-spin text-[#5bb8f5]" />
            <span>Loading older time entries...</span>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Dimmed Backdrop Overlay when FAB menu is open -->
    <Transition name="fade">
      <div
        v-if="isFabMenuOpen"
        @click="isFabMenuOpen = false"
        class="fixed -inset-20 bg-black/40 backdrop-blur-xs z-40 cursor-pointer"
      ></div>
    </Transition>

    <!-- Floating Action Button (FAB) -->
    <div class="fixed right-6 sm:right-8 z-50 flex flex-col items-end space-y-3" style="bottom: calc(2rem + env(safe-area-inset-bottom));">
      <!-- Expanded FAB Options Menu -->
      <Transition name="fade">
        <div v-if="isFabMenuOpen" class="flex flex-col items-end space-y-2.5 transition-all">
          <!-- Manual option -->
          <button
            @click="openNewManualSlideOver()"
            class="flex items-center gap-2 px-4 py-2.5 bg-[#252525] text-white border border-[#262930] rounded-lg font-semibold shadow-xl hover:bg-[#2c2c2c] transition-all cursor-pointer"
          >
            <span>Manual</span>
            <Keyboard class="w-5 h-5 text-[#5bb8f5]" />
          </button>

          <!-- Timer Section with Project Chooser Dropdown Input -->
          <div class="max-w-64 bg-[#252525] border border-[#262930] rounded-lg shadow-xl p-3 space-y-2 transition-all">
            <div class="flex flex-col items-start justify-start gap-2">
              <span class="font-bold text-white shrink-0">Timer</span>
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <select
                  v-model="selectedFabProjectId"
                  class="w-full bg-[#181a1e] text-white border border-[#333333] rounded-lg px-2 py-1.5 font-medium focus:border-[#5bb8f5] focus:outline-none cursor-pointer truncate"
                >
                  <option v-if="projects.length === 0" value="">
                    Default Project
                  </option>
                  <option v-for="p in projects" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
                <button
                  @click="handleStartTimerFromFab"
                  class="p-2"
                  title="Start Timer"
                >
                  <Play class="w-5 h-5 text-[#5bb8f5] fill-current" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Main FAB Button -->
      <button
        @click="isFabMenuOpen = !isFabMenuOpen"
        class="w-14 h-14 rounded-full bg-[#5bb8f5] hover:bg-[#7ac0e3] active:scale-95 text-white flex items-center justify-center shadow-xl transition-all cursor-pointer"
        title="Add time entry"
      >
        <Plus class="w-7 h-7 transition-transform duration-200 stroke-[2.5]" :class="isFabMenuOpen ? 'rotate-45' : ''" />
      </button>
    </div>

    <!-- Full-Screen Right Slide-Over Panel -->
    <TimeEntrySlideOver
      :is-open="isSlideOverOpen"
      :entry="selectedEntryForSlideOver"
      @close="isSlideOverOpen = false, selectedEntryForSlideOver = null"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
