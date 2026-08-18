<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseSelect from '@/components/common/BaseSelect.vue';
import BaseInput from '@/components/common/BaseInput.vue';
import BaseButton from '@/components/common/BaseButton.vue';
import TimeEntrySlideOver from './TimeEntrySlideOver.vue';
import { useProjects } from '@/composables/useProjects';
import { useTimer } from '@/composables/useTimer';
import { Play, Plus, Clock } from 'lucide-vue-next';

const emit = defineEmits(['started']);

const { projects, createProject } = useProjects();
const { startTimer, isTimerLoading, timerError } = useTimer();

const selectedProjectId = ref('');
const selectedTaskId = ref('');
const notesVal = ref('');
const isManualSlideOverOpen = ref(false);
const isPlusMenuOpen = ref(false);
const localError = ref<string | null>(null);

const projectOptions = computed(() =>
  projects.value.map((p) => ({ value: p.id, label: p.name }))
);

const availableTasks = computed(() => {
  const p = projects.value.find((proj) => proj.id === selectedProjectId.value);
  return p?.tasks || [];
});

const taskOptions = computed(() =>
  availableTasks.value.map((t) => ({ value: t.id, label: t.name }))
);

watch(selectedProjectId, () => {
  selectedTaskId.value = '';
});

// Auto select first project
watch(
  () => projects.value,
  (newProjs) => {
    if (newProjs.length > 0 && !selectedProjectId.value) {
      selectedProjectId.value = newProjs[0].id;
    }
  },
  { immediate: true }
);

async function handleStartTimer() {
  localError.value = null;
  let projId = selectedProjectId.value;

  if (!projId) {
    if (projects.value.length === 0) {
      const newP = await createProject('Default Project');
      if (newP) {
        projId = newP.id;
        selectedProjectId.value = newP.id;
      }
    } else {
      projId = projects.value[0].id;
      selectedProjectId.value = projId;
    }
  }

  if (!projId) {
    localError.value = 'Please select a project';
    return;
  }

  const success = await startTimer(projId, selectedTaskId.value || null, notesVal.value);
  if (success) {
    notesVal.value = '';
    emit('started');
  } else {
    localError.value = timerError.value || 'Failed to start timer';
  }
}
</script>

<template>
  <div class="w-full bg-[#252525] border border-[#262930] rounded-2xl p-6 space-y-5 shadow-lg text-white">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-bold text-white tracking-tight">What are you working on?</h2>
        <p class="text-xs text-[#888888]">Select a project and task to start tracking</p>
      </div>

      <!-- Prominent + Action Button -->
      <div class="relative">
        <button
          @click="isPlusMenuOpen = !isPlusMenuOpen"
          class="w-9 h-9 rounded-full bg-[#181a1e] hover:bg-[#202124] border border-[#262930] flex items-center justify-center text-white transition-colors cursor-pointer"
          title="Add time option"
        >
          <Plus class="w-4 h-4" />
        </button>

        <div v-if="isPlusMenuOpen" class="fixed inset-0 z-20" @click="isPlusMenuOpen = false"></div>

        <div
          v-if="isPlusMenuOpen"
          class="absolute right-0 mt-2 w-48 bg-[#181a1e] border border-[#262930] rounded-xl shadow-2xl py-1 z-30 text-xs"
        >
          <button
            @click="isPlusMenuOpen = false; handleStartTimer()"
            class="w-full text-left px-3 py-2 flex items-center gap-2 text-white hover:bg-[#202124] font-medium cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 text-[#5bb8f5]" />
            <span>Start timer now</span>
          </button>
          <button
            @click="isPlusMenuOpen = false; isManualSlideOverOpen = true"
            class="w-full text-left px-3 py-2 flex items-center gap-2 text-white hover:bg-[#202124] font-medium border-t border-[#262930] cursor-pointer"
          >
            <Clock class="w-3.5 h-3.5 text-[#5bb8f5]" />
            <span>Add manual interval</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="localError" class="p-3 bg-red-950/80 border border-red-800 text-xs font-mono text-red-300 rounded-xl">
      {{ localError }}
    </div>

    <!-- Empty projects warning -->
    <div v-if="projects.length === 0" class="p-4 bg-[#181a1e] border border-[#262930] rounded-xl text-center text-xs text-[#888888] space-y-2">
      <p>No projects exist in this space yet.</p>
      <p class="text-[11px] text-[#888888]/60">Ask the Space owner to create a project to start tracking time.</p>
    </div>

    <div v-else class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BaseSelect
          v-model="selectedProjectId"
          label="Project"
          :options="projectOptions"
          placeholder="Select Project"
          required
        />

        <BaseSelect
          v-model="selectedTaskId"
          label="Task (Optional)"
          :options="taskOptions"
          placeholder="Select Task"
          :disabled="taskOptions.length === 0"
        />
      </div>

      <BaseInput
        v-model="notesVal"
        label="Notes (Optional)"
        placeholder="Brief note on what you are doing..."
      />

      <div class="flex items-center justify-between pt-2">
        <button
          type="button"
          @click="isManualSlideOverOpen = true"
          class="text-xs font-semibold text-[#5bb8f5] hover:text-[#7ac0e3] cursor-pointer flex items-center gap-1"
        >
          <span>+ Manual interval</span>
        </button>

        <button
          type="button"
          :disabled="isTimerLoading"
          @click="handleStartTimer"
          class="px-6 py-2.5 bg-[#5bb8f5] hover:bg-[#7ac0e3] active:bg-[#4aa7e4] text-white font-bold text-xs tracking-wider uppercase rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-2"
        >
          <Play class="w-3.5 h-3.5 fill-white stroke-none" />
          <span>START TIMER</span>
        </button>
      </div>
    </div>

    <!-- Manual Interval Slide-Over -->
    <TimeEntrySlideOver :is-open="isManualSlideOverOpen" @close="isManualSlideOverOpen = false" />
  </div>
</template>
