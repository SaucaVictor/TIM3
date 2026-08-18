<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue';
import BaseSelect from '@/components/common/BaseSelect.vue';
import BaseInput from '@/components/common/BaseInput.vue';
import BaseButton from '@/components/common/BaseButton.vue';
import { useProjects } from '@/composables/useProjects';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { Calendar, Check } from 'lucide-vue-next';

interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

const { projects } = useProjects();
const { addManualEntry, isLoadingEntries, entriesError } = useTimeEntries();

const selectedProjectId = ref('');
const selectedTaskId = ref('');
const dateVal = ref(new Date().toISOString().split('T')[0]);
const startTimeVal = ref('09:00');
const endTimeVal = ref('10:00');
const notesVal = ref('');
const durationMinutes = ref(60);
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

function adjustMinutes(delta: number) {
  let newMins = durationMinutes.value + delta;
  if (newMins < 1) newMins = 1;
  durationMinutes.value = newMins;

  if (startTimeVal.value) {
    const [h, m] = startTimeVal.value.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(h, m, 0, 0);
    const endDate = new Date(startDate.getTime() + newMins * 60 * 1000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    endTimeVal.value = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  }
}

async function handleSubmit() {
  localError.value = null;
  if (!selectedProjectId.value) {
    localError.value = 'Please select a project';
    return;
  }
  if (!startTimeVal.value || !endTimeVal.value || !dateVal.value) {
    localError.value = 'Please specify date, start time, and end time';
    return;
  }

  const startISO = `${dateVal.value}T${startTimeVal.value}:00`;
  const endISO = `${dateVal.value}T${endTimeVal.value}:00`;

  if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
    localError.value = 'End time must be after start time';
    return;
  }

  const success = await addManualEntry({
    projectId: selectedProjectId.value,
    taskId: selectedTaskId.value || null,
    startedAt: new Date(startISO).toISOString(),
    endedAt: new Date(endISO).toISOString(),
    notes: notesVal.value,
  });

  if (success) {
    notesVal.value = '';
    emit('close');
  } else {
    localError.value = entriesError.value || 'Failed to save time entry';
  }
}
</script>

<template>
  <BaseModal :is-open="isOpen" title="New time entry" subtitle="Manual entry" @close="emit('close')">
    <form @submit.prevent="handleSubmit" class="space-y-4 text-xs font-medium">
      <div v-if="localError" class="p-3 bg-red-950/80 border-2 border-black text-xs font-mono text-red-300 rounded-xl">
        {{ localError }}
      </div>

      <!-- Start, End, Date Row -->
      <div class="p-3.5 bg-[#17191c] border-2 border-[#36383b] rounded-2xl space-y-3 shadow-[2px_2px_0px_#000]">
        <div class="flex items-center justify-between text-[#a5a5aa] font-mono text-xs font-bold uppercase">
          <div class="flex items-center gap-2">
            <Calendar class="w-4 h-4 text-[#69c9f5]" />
            <span>Date & Time</span>
          </div>
          <input
            v-model="dateVal"
            type="date"
            class="bg-transparent text-white border-0 font-mono text-xs focus:ring-0 p-0 text-right cursor-pointer"
          />
        </div>

        <div class="grid grid-cols-2 gap-3 pt-1 border-t-2 border-[#36383b]">
          <div>
            <label class="text-[10px] text-[#a5a5aa] font-mono font-bold uppercase">Start</label>
            <input
              v-model="startTimeVal"
              type="time"
              class="w-full bg-[#303133] text-white border-2 border-[#36383b] rounded-xl px-2.5 py-1.5 font-mono text-xs font-bold"
            />
          </div>
          <div>
            <label class="text-[10px] text-[#a5a5aa] font-mono font-bold uppercase">End</label>
            <input
              v-model="endTimeVal"
              type="time"
              class="w-full bg-[#303133] text-white border-2 border-[#36383b] rounded-xl px-2.5 py-1.5 font-mono text-xs font-bold"
            />
          </div>
        </div>
      </div>

      <!-- Quick Duration Adjuster -->
      <div class="p-4 bg-[#17191c] border-2 border-[#36383b] rounded-2xl space-y-3 text-center shadow-[2px_2px_0px_#000]">
        <div class="text-[10px] text-[#a5a5aa] uppercase font-mono font-bold tracking-wider">Duration</div>
        <div class="text-3xl font-mono font-bold text-white tracking-tight">
          {{ Math.floor(durationMinutes / 60).toString().padStart(2, '0') }}:{{ (durationMinutes % 60).toString().padStart(2, '0') }}:00
        </div>

        <div class="flex items-center justify-center gap-2 pt-1 font-mono text-xs">
          <button
            type="button"
            @click="adjustMinutes(-60)"
            class="px-2.5 py-1 bg-[#303133] border border-black hover:bg-[#393a3d] text-neutral-300 rounded-lg transition-colors font-bold active:translate-y-[1px]"
          >
            -1h
          </button>
          <button
            type="button"
            @click="adjustMinutes(-15)"
            class="px-2.5 py-1 bg-[#303133] border border-black hover:bg-[#393a3d] text-neutral-300 rounded-lg transition-colors font-bold active:translate-y-[1px]"
          >
            -15m
          </button>
          <button
            type="button"
            @click="adjustMinutes(15)"
            class="px-2.5 py-1 bg-[#303133] border border-black hover:bg-[#393a3d] text-[#69c9f5] font-bold rounded-lg transition-colors active:translate-y-[1px]"
          >
            +15m
          </button>
          <button
            type="button"
            @click="adjustMinutes(60)"
            class="px-2.5 py-1 bg-[#303133] border border-black hover:bg-[#393a3d] text-[#69c9f5] font-bold rounded-lg transition-colors active:translate-y-[1px]"
          >
            +1h
          </button>
        </div>
      </div>

      <!-- Description / Notes -->
      <BaseInput
        v-model="notesVal"
        label="What have you worked on?"
        placeholder="e.g. Frontend development, Bug fixing"
      />

      <!-- Project Selector -->
      <BaseSelect
        v-model="selectedProjectId"
        label="Project"
        :options="projectOptions"
        placeholder="Select project"
        required
      />

      <!-- Task Selector -->
      <BaseSelect
        v-if="taskOptions.length > 0"
        v-model="selectedTaskId"
        label="Task (Optional)"
        :options="taskOptions"
        placeholder="Select task"
      />

      <div class="flex justify-end gap-2 pt-3">
        <BaseButton variant="outline" @click="emit('close')">Cancel</BaseButton>
        <BaseButton type="submit" variant="cyan" :loading="isLoadingEntries" class="px-6 font-bold">
          <Check class="w-4 h-4" />
          <span>Save</span>
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
