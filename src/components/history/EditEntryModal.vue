<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '@/components/common/BaseModal.vue';
import BaseSelect from '@/components/common/BaseSelect.vue';
import BaseInput from '@/components/common/BaseInput.vue';
import BaseButton from '@/components/common/BaseButton.vue';
import { useProjects } from '@/composables/useProjects';
import { useTimeEntries } from '@/composables/useTimeEntries';
import type { TimeEntry } from '@/types';

interface Props {
  isOpen: boolean;
  entry: TimeEntry | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

const { projects } = useProjects();
const { updateEntry, isLoadingEntries, entriesError } = useTimeEntries();

const selectedProjectId = ref('');
const selectedTaskId = ref('');
const dateVal = ref('');
const startTimeVal = ref('');
const endTimeVal = ref('');
const notesVal = ref('');
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

watch(
  () => props.entry,
  (newEntry) => {
    if (newEntry) {
      selectedProjectId.value = newEntry.project_id;
      selectedTaskId.value = newEntry.task_id || '';
      notesVal.value = newEntry.notes || '';

      if (newEntry.started_at) {
        const d = new Date(newEntry.started_at);
        dateVal.value = d.toISOString().split('T')[0];
        const pad = (n: number) => n.toString().padStart(2, '0');
        startTimeVal.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }

      if (newEntry.ended_at) {
        const d = new Date(newEntry.ended_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        endTimeVal.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
  },
  { immediate: true }
);

async function handleSave() {
  if (!props.entry) return;
  localError.value = null;

  if (!selectedProjectId.value) {
    localError.value = 'Project is required';
    return;
  }

  const startISO = `${dateVal.value}T${startTimeVal.value}:00`;
  const endISO = `${dateVal.value}T${endTimeVal.value}:00`;

  if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
    localError.value = 'End time must be after start time';
    return;
  }

  const success = await updateEntry(props.entry.id, {
    projectId: selectedProjectId.value,
    taskId: selectedTaskId.value || null,
    startedAt: new Date(startISO).toISOString(),
    endedAt: new Date(endISO).toISOString(),
    notes: notesVal.value,
  });

  if (success) {
    emit('close');
  } else {
    localError.value = entriesError.value || 'Failed to update time entry';
  }
}
</script>

<template>
  <BaseModal :is-open="isOpen" title="Edit time entry" @close="emit('close')">
    <form @submit.prevent="handleSave" class="space-y-4">
      <div v-if="localError" class="p-3 bg-red-950/60 border border-red-800 text-xs text-red-300 rounded-xl">
        {{ localError }}
      </div>

      <BaseSelect
        v-model="selectedProjectId"
        label="Project"
        :options="projectOptions"
        required
      />

      <BaseSelect
        v-if="taskOptions.length > 0"
        v-model="selectedTaskId"
        label="Task (Optional)"
        :options="taskOptions"
        placeholder="Select Task"
      />

      <BaseInput
        v-model="dateVal"
        type="date"
        label="Date"
        required
      />

      <div class="grid grid-cols-2 gap-3">
        <BaseInput
          v-model="startTimeVal"
          type="time"
          label="Start Time"
          required
        />
        <BaseInput
          v-model="endTimeVal"
          type="time"
          label="End Time"
          required
        />
      </div>

      <BaseInput
        v-model="notesVal"
        label="Description / Notes"
        placeholder="Notes..."
      />

      <div class="flex justify-end gap-2 pt-2">
        <BaseButton variant="outline" @click="emit('close')">Cancel</BaseButton>
        <BaseButton type="submit" variant="cyan" :loading="isLoadingEntries">
          Save changes
        </BaseButton>
      </div>
    </form>
  </BaseModal>
</template>
