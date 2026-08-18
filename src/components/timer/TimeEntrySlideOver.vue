<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useProjects } from '@/composables/useProjects';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useSpace } from '@/composables/useSpace';
import { useSwipeGesture } from '@/composables/useSwipeGesture';
import type { TimeEntry, EntryStatus } from '@/types';
import {
  X,
  Clock,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Folder,
  ClipboardList,
  Check,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Plus,
  Search,
  Loader2,
  Loader,
  Lock,
} from 'lucide-vue-next';

interface Props {
  isOpen: boolean;
  entry?: TimeEntry | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

const router = useRouter();
const route = useRoute();

const { isOwner } = useSpace();
const { projects, createProject, createTask } = useProjects();
const { addManualEntry, updateEntry, deleteEntry, isLoadingEntries } = useTimeEntries();

const mainPanelRef = ref<HTMLElement | null>(null);
const subPanelRef = ref<HTMLElement | null>(null);

// Sub slide-over view state: null | 'project' | 'task'
const activeSubSlide = ref<'project' | 'task' | null>(null);

const isSubmitting = ref(false);
const selectedStatus = ref<EntryStatus>('awaiting');

// Swipe Right on Sub-Slider Panel (closes sub-slider independently without bubbling)
useSwipeGesture(subPanelRef, {
  stopPropagation: true,
  onSwipeRight: () => {
    if (activeSubSlide.value) {
      handleCloseSubSlide();
    }
  },
});

// Swipe Right on Main Slide-Over Panel (closes main slide-over if sub-slider is not open)
useSwipeGesture(mainPanelRef, {
  onSwipeRight: () => {
    if (props.isOpen && !activeSubSlide.value) {
      handleCloseSlideOver();
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
  '#84cc16',
  '#0284c7',
  '#e11d48',
  '#7c3aed',
];

function getItemColor(index: number): string {
  return colorPalette[index % colorPalette.length];
}

const isEditMode = computed(() => Boolean(props.entry));

// Entry is locked when it's approved/paid and the current user is not the owner
const isLocked = computed(() =>
  isEditMode.value &&
  !isOwner.value &&
  (props.entry?.status === 'approved' || props.entry?.status === 'paid')
);

const selectedProjectId = ref('');
const selectedTaskId = ref('');
const dateVal = ref(new Date().toISOString().split('T')[0]);
const startTimeVal = ref('15:05');
const endTimeVal = ref('15:05');
const notesVal = ref('');
const durationMinutes = ref(0);
const durationSeconds = ref(0); // Total seconds (sub-minute part)
const localError = ref<string | null>(null);

function resetFormState() {
  selectedProjectId.value = '';
  selectedTaskId.value = '';
  dateVal.value = new Date().toISOString().split('T')[0];
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  startTimeVal.value = nowTime;
  endTimeVal.value = nowTime;
  notesVal.value = '';
  durationMinutes.value = 0;
  durationSeconds.value = 0;
  localError.value = null;
  activeSubSlide.value = null;
  projectSearch.value = '';
  taskSearch.value = '';
}

// Duration breakdown for editable HH:MM:SS display
const durH = computed({
  get: () => Math.floor((durationMinutes.value * 60 + durationSeconds.value) / 3600),
  set: (v: number) => {
    const totalSec = Math.max(0, v) * 3600 + durM.value * 60 + durSDisplay.value;
    _setDurationFromSeconds(totalSec);
  },
});
const durM = computed({
  get: () => Math.floor(((durationMinutes.value * 60 + durationSeconds.value) % 3600) / 60),
  set: (v: number) => {
    const totalSec = durH.value * 3600 + Math.min(59, Math.max(0, v)) * 60 + durSDisplay.value;
    _setDurationFromSeconds(totalSec);
  },
});
const durSDisplay = computed({
  get: () => (durationMinutes.value * 60 + durationSeconds.value) % 60,
  set: (v: number) => {
    const totalSec = durH.value * 3600 + durM.value * 60 + Math.min(59, Math.max(0, v));
    _setDurationFromSeconds(totalSec);
  },
});

function _setDurationFromSeconds(totalSec: number) {
  if (totalSec < 0) totalSec = 0;
  durationMinutes.value = Math.floor(totalSec / 60);
  durationSeconds.value = totalSec % 60;
  // Push new end time from start + duration
  if (startTimeVal.value) {
    const [h, m] = startTimeVal.value.split(':').map(Number);
    const startBase = new Date();
    startBase.setHours(h, m, 0, 0);
    const endDate = new Date(startBase.getTime() + totalSec * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    endTimeVal.value = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  }
}

// Search inputs for sub-slideovers
const projectSearch = ref('');
const taskSearch = ref('');

// Inline creation inputs
const isCreatingProject = ref(false);
const newProjectName = ref('');
const isCreatingTask = ref(false);
const newTaskName = ref('');

const filteredProjects = computed(() => {
  if (!projectSearch.value.trim()) return projects.value;
  return projects.value.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.value.toLowerCase())
  );
});

const currentProject = computed(() =>
  projects.value.find((p) => p.id === selectedProjectId.value)
);

const availableTasks = computed(() => currentProject.value?.tasks || []);

const filteredTasks = computed(() => {
  if (!taskSearch.value.trim()) return availableTasks.value;
  return availableTasks.value.filter((t) =>
    t.name.toLowerCase().includes(taskSearch.value.toLowerCase())
  );
});

const selectedProjectName = computed(() => {
  return currentProject.value ? currentProject.value.name : 'Select project';
});

const selectedTaskName = computed(() => {
  const t = availableTasks.value.find((task) => task.id === selectedTaskId.value);
  return t ? t.name : 'Select task';
});

watch(
  () => props.entry,
  (newEntry) => {
    activeSubSlide.value = null;
    localError.value = null;

    if (newEntry) {
      selectedProjectId.value = newEntry.project_id;
      selectedTaskId.value = newEntry.task_id || '';
      selectedStatus.value = (newEntry.status as EntryStatus) || 'awaiting';
      notesVal.value = newEntry.notes || '';

      if (newEntry.started_at) {
        const d = new Date(newEntry.started_at);
        dateVal.value = d.toISOString().split('T')[0];
        const pad = (n: number) => n.toString().padStart(2, '0');
        startTimeVal.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        durationSeconds.value = d.getSeconds();
      }

      if (newEntry.ended_at) {
        const d = new Date(newEntry.ended_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        endTimeVal.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const diffSec = Math.max(0, Math.round((new Date(newEntry.ended_at).getTime() - new Date(newEntry.started_at).getTime()) / 1000));
        durationMinutes.value = Math.floor(diffSec / 60);
        durationSeconds.value = diffSec % 60;
      }
    } else {
      selectedProjectId.value = '';
      selectedTaskId.value = '';
      selectedStatus.value = 'awaiting';
      notesVal.value = '';
      dateVal.value = new Date().toISOString().split('T')[0];
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      startTimeVal.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      endTimeVal.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      durationMinutes.value = 0;
      durationSeconds.value = 0;
    }
  },
  { immediate: true }
);

function adjustMinutes(delta: number) {
  const totalSec = durationMinutes.value * 60 + durationSeconds.value + delta * 60;
  _setDurationFromSeconds(totalSec);
}

function handleTimeChange() {
  if (startTimeVal.value && endTimeVal.value) {
    const startMs = new Date(`${dateVal.value}T${startTimeVal.value}:00`).getTime();
    const endMs = new Date(`${dateVal.value}T${endTimeVal.value}:00`).getTime();
    const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000));
    durationMinutes.value = Math.floor(diffSec / 60);
    durationSeconds.value = diffSec % 60;
  }
}

function selectProject(id: string) {
  selectedProjectId.value = id;
  selectedTaskId.value = '';
  activeSubSlide.value = null;
}

function selectTask(id: string) {
  selectedTaskId.value = id;
  activeSubSlide.value = null;
}

async function handleCreateProject() {
  if (!newProjectName.value.trim()) return;
  const p = await createProject(newProjectName.value.trim());
  if (p) {
    selectedProjectId.value = p.id;
    selectedTaskId.value = '';
    newProjectName.value = '';
    isCreatingProject.value = false;
    activeSubSlide.value = null;
  }
}

async function handleCreateTask() {
  if (!newTaskName.value.trim() || !selectedProjectId.value) return;
  const t = await createTask(selectedProjectId.value, newTaskName.value.trim());
  if (t) {
    selectedTaskId.value = t.id;
    newTaskName.value = '';
    isCreatingTask.value = false;
    activeSubSlide.value = null;
  }
}

// Mobile Back Button / Route Query Synchronization + body scroll lock
watch(
  () => props.isOpen,
  (open) => {
    // Lock/unlock background scroll
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      const modalQuery = props.entry ? props.entry.id : 'new';
      if (route.query.entryModal !== modalQuery) {
        router.push({ query: { ...route.query, entryModal: modalQuery } });
      }
    } else {
      // Reset form & sub-slide state on close
      resetFormState();
      if (route.query.entryModal) {
        const query = { ...route.query };
        delete query.entryModal;
        delete query.select;
        router.replace({ query });
      }
    }
  }
);

watch(
  () => activeSubSlide.value,
  (newSubSlide) => {
    if (newSubSlide) {
      if (route.query.select !== newSubSlide) {
        router.push({ query: { ...route.query, select: newSubSlide } });
      }
    } else {
      if (route.query.select) {
        const query = { ...route.query };
        delete query.select;
        router.replace({ query });
      }
    }
  }
);

watch(
  () => route.query,
  (newQuery) => {
    if (props.isOpen) {
      if (!newQuery.entryModal) {
        emit('close');
      } else {
        const targetSubSlide = (newQuery.select as any) || null;
        if (activeSubSlide.value !== targetSubSlide) {
          activeSubSlide.value = targetSubSlide;
        }
      }
    }
  },
  { deep: true }
);

function handleCloseSlideOver() {
  resetFormState();
  emit('close');
  if (route.query.entryModal) {
    router.back();
  }
}

function handleCloseSubSlide() {
  activeSubSlide.value = null;
  if (route.query.select) {
    router.back();
  }
}

async function handleSave() {
  if (isSubmitting.value || isLoadingEntries.value || isLocked.value) return;
  isSubmitting.value = true;
  localError.value = null;

  try {
    if (!selectedProjectId.value) {
      localError.value = 'Please select a project';
      return;
    }

    if (!startTimeVal.value || !endTimeVal.value || !dateVal.value) {
      localError.value = 'Please specify date, start time, and end time';
      return;
    }

    const startISO = `${dateVal.value}T${startTimeVal.value}:00`;
    const totalDurationSec = durationMinutes.value * 60 + durationSeconds.value;
    const startMs = new Date(startISO).getTime();
    const endISO = new Date(startMs + totalDurationSec * 1000).toISOString();

    const finalNotes = notesVal.value.trim();

    let success = false;
    if (isEditMode.value && props.entry) {
      success = await updateEntry(props.entry.id, {
        projectId: selectedProjectId.value,
        taskId: selectedTaskId.value || null,
        startedAt: new Date(startISO).toISOString(),
        endedAt: new Date(endISO).toISOString(),
        notes: finalNotes,
        status: selectedStatus.value,
      });
    } else {
      success = await addManualEntry({
        projectId: selectedProjectId.value,
        taskId: selectedTaskId.value || null,
        startedAt: new Date(startISO).toISOString(),
        endedAt: new Date(endISO).toISOString(),
        notes: finalNotes,
        status: selectedStatus.value,
      });
    }

    if (success) {
      handleCloseSlideOver();
    } else {
      localError.value = 'Failed to save time entry';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDelete() {
  if (isSubmitting.value || isLoadingEntries.value) return;
  if (props.entry && confirm('Delete this time entry?')) {
    isSubmitting.value = true;
    try {
      await deleteEntry(props.entry.id);
      handleCloseSlideOver();
    } finally {
      isSubmitting.value = false;
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 overflow-hidden pointer-events-none"
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
          @click="handleCloseSlideOver"
        ></div>
      </Transition>

      <!-- Main Slide-Over Panel Transition (Right-to-Left Entry, Left-to-Right Leave) -->
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
          class="fixed inset-y-0 right-0 max-w-full w-full sm:w-88 bg-[#161618] text-white shadow-2xl flex flex-col z-50 border-l border-[#262930] pointer-events-auto"
        >
          <div class="px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-2 shrink-0" style="padding-top: calc(1.5rem + env(safe-area-inset-top));">
            <button
              @click="activeSubSlide ? handleCloseSubSlide() : handleCloseSlideOver()"
              :disabled="isSubmitting"
              class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center overflow-hidden"
              :title="activeSubSlide ? 'Back' : 'Close'"
            >
              <Transition name="fade" mode="out-in">
                <ChevronLeft v-if="activeSubSlide" key="back" class="w-7 h-7" />
                <X v-else key="close" class="w-7 h-7" />
              </Transition>
            </button>

            <!-- Dynamic Center Title & Status Indicator with Transitions -->
            <div class="flex flex-col items-center justify-center w-full min-w-0">
              <Transition name="fade" mode="out-in">
                <h2 :key="activeSubSlide || 'main'" class="text-xl font-bold text-center w-full text-white tracking-tight truncate">
                  <template v-if="activeSubSlide === 'project'">Select project</template>
                  <template v-else-if="activeSubSlide === 'task'">Select task</template>
                  <template v-else>{{ isEditMode ? 'Edit time entry' : 'New time entry' }}</template>
                </h2>
              </Transition>

              <!-- Status subtext ONLY shown under title when editing existing time entries with transition -->
              <Transition name="fade" mode="out-in">
                <div v-if="!activeSubSlide && isEditMode && selectedStatus" :key="selectedStatus" class="flex items-center justify-center gap-1.5 mt-0.5 font-semibold text-xs">
                  <template v-if="selectedStatus === 'awaiting'">
                    <Loader class="w-3.5 h-3.5 text-[#888888]" />
                    <span class="text-[#888888]">Awaiting Approval</span>
                  </template>
                  <template v-else-if="selectedStatus === 'approved'">
                    <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
                    <span class="text-emerald-400">Approved</span>
                  </template>
                  <template v-else-if="selectedStatus === 'paid'">
                    <CircleDollarSign class="w-3.5 h-3.5 text-emerald-400" />
                    <span class="text-emerald-400">Paid</span>
                  </template>
                </div>
              </Transition>
            </div>

            <!-- Right Action Button with Transition -->
            <div class="shrink-0 flex items-center justify-end w-10 h-10">
              <Transition name="fade">
                <button
                  v-if="!activeSubSlide && isEditMode && !isLocked"
                  @click="handleDelete"
                  :disabled="isSubmitting || isLoadingEntries"
                  class="p-1.5 text-red-400 border border-red-950/60 active:scale-95 hover:text-red-300 bg-red-950/40 hover:bg-red-950/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  title="Delete entry"
                >
                  <Loader2 v-if="isSubmitting" class="w-7 h-7 animate-spin" />
                  <Trash2 v-else class="w-7 h-7" />
                </button>
              </Transition>
            </div>
          </div>

          <div v-if="localError" class="mx-4 mt-4 mb-1 p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-lg">
            {{ localError }}
          </div>

          <!-- Relative Wrapper for Main Content and Sub-Slide-Overs -->
          <div class="relative flex-1 overflow-hidden">
            <!-- Lock Overlay: shown for non-owners on approved/paid entries -->
            <Transition
              enter-active-class="transition-opacity duration-200"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
            >
              <div
                v-if="isLocked && !activeSubSlide"
                class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#161618]/40 backdrop-blur-[1px] pointer-events-auto"
              >
                <div class="flex flex-col items-center gap-3 px-8 text-center">
                  <div class="w-14 h-14 rounded-full bg-[#252525] border border-[#333333] flex items-center justify-center">
                    <Lock class="w-6 h-6 text-[#888888]" />
                  </div>
                  <div class="space-y-1">
                    <p class="font-bold text-white text-base">
                      {{ props.entry?.status === 'paid' ? 'Entry marked as Paid' : 'Entry has been Approved' }}
                    </p>
                    <p class="text-xs text-[#888888]">
                      This time entry is locked and cannot be edited.
                    </p>
                  </div>
                </div>
              </div>
            </Transition>
            <!-- MAIN FORM CONTENT -->
            <div class="h-full p-4 pb-24 space-y-4" :class="[ isLocked && !activeSubSlide ? 'overflow-hidden' : 'overflow-y-auto' ]">
              <!-- Date, Start & End Inputs Section -->
              <div class="flex flex-col gap-2.5 bg-[#252525] p-4 rounded-lg">
                <!-- Date -->
                <div class="flex items-center gap-3">
                  <span class="text-[#888888] font-medium w-12">Date</span>
                  <input
                    v-model="dateVal"
                    type="date"
                    style="color-scheme: dark;"
                    class="font-bold text-white bg-transparent border-0 w-full py-1 focus:ring-0 cursor-pointer"
                  />
                </div>

                <!-- Start -->
                <div class="flex items-center gap-3">
                  <span class="text-[#888888] font-medium w-12">Start</span>
                  <input
                    v-model="startTimeVal"
                    @change="handleTimeChange"
                    type="time"
                    style="color-scheme: dark;"
                    class="font-bold text-white bg-transparent border-0 w-full py-1 focus:ring-0 cursor-pointer"
                  />
                </div>

                <!-- End -->
                <div class="flex items-center gap-3">
                  <span class="text-[#888888] font-medium w-12">End</span>
                  <input
                    v-model="endTimeVal"
                    @change="handleTimeChange"
                    type="time"
                    style="color-scheme: dark;"
                    class="font-bold text-white bg-transparent border-0 py-1 focus:ring-0 cursor-pointer w-full"
                  />
                </div>
              </div>

              <!-- 2. Duration Hero Section -->
              <div class="space-y-4 gap-2.5 bg-[#252525] p-4 rounded-lg">
                <div class="flex items-center gap-3.5 font-semibold text-white">
                  <Clock class="w-5 h-5 text-[#888888]" />
                  <span>Duration</span>
                </div>

                <!-- Editable HH : MM : SS segments -->
                <div class="flex items-center justify-center gap-1 text-center py-1">
                  <!-- Hours -->
                  <input
                    type="number"
                    :value="durH"
                    @change="durH = Number(($event.target as HTMLInputElement).value)"
                    min="0"
                    max="23"
                    class="w-20 bg-transparent text-white text-4xl sm:text-5xl font-bold tracking-tight text-center appearance-none border-0 focus:outline-none focus:ring-0 focus:bg-[#2e2e30] rounded-lg cursor-text p-1 transition-colors"
                    title="Hours"
                  />
                  <span class="text-4xl sm:text-5xl font-bold text-[#444] select-none">:</span>
                  <!-- Minutes -->
                  <input
                    type="number"
                    :value="durM"
                    @change="durM = Number(($event.target as HTMLInputElement).value)"
                    min="0"
                    max="59"
                    class="w-20 bg-transparent text-white text-4xl sm:text-5xl font-bold tracking-tight text-center appearance-none border-0 focus:outline-none focus:ring-0 focus:bg-[#2e2e30] rounded-lg cursor-text p-1 transition-colors"
                    title="Minutes"
                  />
                  <span class="text-4xl sm:text-5xl font-bold text-[#444] select-none">:</span>
                  <!-- Seconds -->
                  <input
                    type="number"
                    :value="durSDisplay"
                    @change="durSDisplay = Number(($event.target as HTMLInputElement).value)"
                    min="0"
                    max="59"
                    class="w-20 bg-transparent text-white text-4xl sm:text-5xl font-bold tracking-tight text-center appearance-none border-0 focus:outline-none focus:ring-0 focus:bg-[#2e2e30] rounded-lg cursor-text p-1 transition-colors"
                    title="Seconds"
                  />
                </div>

                <!-- Adjuster row matching Photo 2: -1h -15min +15min +1h -->
                <div class="flex items-center justify-center gap-6 pt-1 text-sm font-semibold">
                  <button
                    type="button"
                    @click="adjustMinutes(-60)"
                    class="text-[#888888] active:scale-90 hover:text-white transition-all cursor-pointer"
                  >
                    -1h
                  </button>
                  <button
                    type="button"
                    @click="adjustMinutes(-15)"
                    class="text-[#888888] active:scale-90 hover:text-white transition-all cursor-pointer"
                  >
                    -15min
                  </button>
                  <button
                    type="button"
                    @click="adjustMinutes(15)"
                    class="text-[#5bb8f5] active:scale-90 hover:text-[#7ac0e3] font-bold transition-all cursor-pointer"
                  >
                    +15min
                  </button>
                  <button
                    type="button"
                    @click="adjustMinutes(60)"
                    class="text-[#5bb8f5] active:scale-90 hover:text-[#7ac0e3] font-bold transition-all cursor-pointer"
                  >
                    +1h
                  </button>
                </div>
              </div>

              <!-- 3. What have you worked on? Card -->
              <div class="bg-[#252525] p-4 rounded-lg flex items-center gap-3.5">
                <FileText class="w-5 h-5 text-[#888888] shrink-0" />
                <input
                  v-model="notesVal"
                  type="text"
                  placeholder="What have you worked on?"
                  class="w-full text-white placeholder:text-[#666666] bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                />
              </div>

              <!-- 4. Project Select Card -->
              <div
                @click="activeSubSlide = 'project'"
                class="bg-[#252525] hover:bg-[#2c2c2c] active:scale-[0.99] p-4 rounded-lg flex items-center justify-between cursor-pointer group transition-all"
              >
                <div class="flex items-center gap-3.5">
                  <Folder class="w-5 h-5 text-[#888888] shrink-0 group-hover:text-white transition-colors" />
                  <div class="flex flex-col">
                    <span class="font-bold text-white">Project</span>
                    <span
                      class="text-sm transition-colors"
                      :class="currentProject ? 'text-[#5bb8f5] font-semibold' : 'text-[#888888]'"
                    >
                      {{ selectedProjectName }}
                    </span>
                  </div>
                </div>
                <ChevronRight class="w-4 h-4 text-[#888888] shrink-0 group-hover:text-white transition-colors" />
              </div>

              <!-- 5. Task Select Card -->
              <div
                @click="activeSubSlide = 'task'"
                class="bg-[#252525] hover:bg-[#2c2c2c] active:scale-[0.99] p-4 rounded-lg flex items-center justify-between cursor-pointer group transition-all"
              >
                <div class="flex items-center gap-3.5">
                  <ClipboardList class="w-5 h-5 text-[#888888] shrink-0 group-hover:text-white transition-colors" />
                  <div class="flex flex-col">
                    <span class="font-bold text-white">Task</span>
                    <span
                      class="text-sm transition-colors"
                      :class="selectedTaskId ? 'text-white font-medium' : 'text-[#888888]'"
                    >
                      {{ selectedTaskName }}
                    </span>
                  </div>
                </div>
                <ChevronRight class="w-4 h-4 shrink-0 text-[#888888] group-hover:text-white transition-colors" />
              </div>

              <!-- 7. Hours Status Card (Owner Only) -->
              <div v-if="isOwner" class="bg-[#252525] p-4 rounded-lg space-y-2">
                <div class="font-bold text-white uppercase tracking-wider">Hours Status</div>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    @click="selectedStatus = 'awaiting'"
                    class="py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border text-xs"
                    :class="selectedStatus === 'awaiting' ? 'bg-[#161618] text-white border-[#888888]' : 'bg-[#161618] text-[#666666] border-[#333333]'"
                  >
                    <Loader class="w-3.5 h-3.5 text-[#888888]" />
                    <span>Awaiting</span>
                  </button>

                  <button
                    type="button"
                    @click="selectedStatus = 'approved'"
                    class="py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border text-xs"
                    :class="selectedStatus === 'approved' ? 'bg-[#161618] text-emerald-400 border-emerald-500/50' : 'bg-[#161618] text-[#666666] border-[#333333]'"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approved</span>
                  </button>

                  <button
                    type="button"
                    @click="selectedStatus = 'paid'"
                    class="py-2 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border text-xs"
                    :class="selectedStatus === 'paid' ? 'bg-[#161618] text-emerald-400 border-emerald-500/50' : 'bg-[#161618] text-[#666666] border-[#333333]'"
                  >
                    <CircleDollarSign class="w-3.5 h-3.5 text-emerald-400" />
                    <span>Paid</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- SUB SLIDE-OVER OVERLAY PANEL (SLIDES FROM RIGHT WITH VUE TRANSITION) -->
            <Transition
              enter-active-class="transition-transform duration-300 ease-out"
              enter-from-class="translate-x-full"
              enter-to-class="translate-x-0"
              leave-active-class="transition-transform duration-300 ease-in"
              leave-from-class="translate-x-0"
              leave-to-class="translate-x-full"
            >
              <div
                v-if="activeSubSlide"
                ref="subPanelRef"
                class="absolute inset-0 bg-[#161618] z-30 flex flex-col"
              >
                <!-- PROJECT SELECTION WINDOW -->
                <div v-if="activeSubSlide === 'project'" class="flex flex-col h-full">
                  <!-- Search & Quick Add Card Group -->
                  <div class="px-4 pt-2 shrink-0">
                    <div class="bg-[#252525] p-3 rounded-lg space-y-2.5">
                      <div class="relative flex items-center">
                        <Search class="w-4 h-4 text-[#888888] absolute left-3" />
                        <input
                          v-model="projectSearch"
                          type="text"
                          placeholder="Search projects..."
                          class="w-full h-10 bg-[#161618] text-white text-sm rounded-lg pl-9 pr-4 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none"
                        />
                      </div>

                      <div class="flex gap-2">
                        <input
                          v-model="newProjectName"
                          type="text"
                          placeholder="New project name..."
                          @keyup.enter="handleCreateProject"
                          class="flex-1 h-10 bg-[#161618] text-white text-sm rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none"
                        />
                        <button
                          @click="handleCreateProject"
                          class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                          title="Add Project"
                        >
                          <Plus class="w-7 h-7" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Projects List Group Card -->
                  <div class="px-4 pt-3 pb-8 flex-1 overflow-y-auto">
                    <div v-if="filteredProjects.length > 0" class="bg-[#252525] p-2 rounded-lg space-y-1">
                      <div
                        v-for="(p, idx) in filteredProjects"
                        :key="p.id"
                        @click="selectProject(p.id)"
                        class="flex items-center justify-between p-3 rounded-lg hover:bg-[#1f1f21] active:scale-[0.99] cursor-pointer transition-all"
                        :class="selectedProjectId === p.id ? 'bg-[#1f1f21]' : ''"
                      >
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: getItemColor(idx) }"></div>
                          <div class="flex flex-col min-w-0">
                            <span class="text-sm font-semibold text-white truncate">{{ p.name }}</span>
                            <span v-if="p.responsible_profile" class="text-xs text-[#888888] truncate">
                              {{ p.responsible_profile.full_name || p.responsible_profile.email }}
                            </span>
                          </div>
                        </div>
                        <Check v-if="selectedProjectId === p.id" class="w-4 h-4 text-[#5bb8f5] shrink-0 ml-1" />
                      </div>
                    </div>

                    <div v-else class="py-8 text-center text-xs text-[#888888]">
                      No projects found.
                    </div>
                  </div>
                </div>

                <!-- TASK SELECTION WINDOW -->
                <div v-else-if="activeSubSlide === 'task'" class="flex flex-col h-full">
                  <!-- Search & Quick Add Card Group -->
                  <div class="px-4 pt-2 shrink-0">
                    <div class="bg-[#252525] p-3 rounded-lg space-y-2.5">
                      <div class="relative flex items-center">
                        <Search class="w-4 h-4 text-[#888888] absolute left-3" />
                        <input
                          v-model="taskSearch"
                          type="text"
                          placeholder="Search tasks..."
                          class="w-full h-10 bg-[#161618] text-white text-sm rounded-lg pl-9 pr-4 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none"
                        />
                      </div>

                      <div class="flex gap-2">
                        <input
                          v-model="newTaskName"
                          type="text"
                          placeholder="New task name..."
                          @keyup.enter="handleCreateTask"
                          class="flex-1 h-10 bg-[#161618] text-white text-sm rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none"
                        />
                        <button
                          @click="handleCreateTask"
                          class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center"
                          title="Add Task"
                        >
                          <Plus class="w-7 h-7" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Tasks List Group Card -->
                  <div class="px-4 pt-3 pb-8 flex-1 overflow-y-auto">
                    <div class="bg-[#252525] p-2 rounded-lg space-y-1">
                      <!-- Option: No task -->
                      <div
                        @click="selectTask('')"
                        class="flex items-center justify-between p-3 rounded-lg hover:bg-[#1f1f21] active:scale-[0.99] cursor-pointer transition-all"
                        :class="!selectedTaskId ? 'bg-[#1f1f21]' : ''"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-2.5 h-2.5 rounded-full bg-[#888888]/40 shrink-0"></div>
                          <span class="text-sm text-[#888888]">No task</span>
                        </div>
                        <Check v-if="!selectedTaskId" class="w-4 h-4 text-[#5bb8f5] shrink-0" />
                      </div>

                      <div
                        v-for="(t, idx) in filteredTasks"
                        :key="t.id"
                        @click="selectTask(t.id)"
                        class="flex items-center justify-between p-3 rounded-lg hover:bg-[#1f1f21] active:scale-[0.99] cursor-pointer transition-all"
                        :class="selectedTaskId === t.id ? 'bg-[#1f1f21]' : ''"
                      >
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: getItemColor(idx + 1) }"></div>
                          <span class="text-sm font-semibold text-white truncate">{{ t.name }}</span>
                        </div>
                        <Check v-if="selectedTaskId === t.id" class="w-4 h-4 text-[#5bb8f5] shrink-0 ml-1" />
                      </div>
                    </div>

                    <div v-if="availableTasks.length === 0" class="py-8 text-center text-xs text-[#888888]">
                      No tasks available for this project. Create one above!
                    </div>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- Floating Save Button (Visible only on main view when no selector is open) -->
            <Transition name="fade">
              <div
                v-if="!activeSubSlide && !isLocked"
                class="absolute right-6 z-20 pointer-events-auto"
                style="bottom: calc(1.5rem + env(safe-area-inset-bottom));"
              >
                <button
                  @click="handleSave"
                  :disabled="isSubmitting || isLoadingEntries || isLocked"
                  class="px-6 select-none py-3 bg-[#6396b8] hover:bg-[#7ac0e3] active:bg-[#3c759b] disabled:cursor-not-allowed text-white font-bold rounded-full shadow-2xl shadow-[#5bb8f5]/40 cursor-pointer transition-all active:scale-95 flex items-center gap-2 border border-white/10"
                  :class="{ 'opacity-40': isLocked }"
                >
                  <Loader2 v-if="isSubmitting || isLoadingEntries" class="w-5 h-5 animate-spin" />
                  <Check v-else class="w-4 h-4 stroke-3" />
                  <span>Save</span>
                </button>
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

/* Hide number input spinners for the HH:MM:SS duration segments */
input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
