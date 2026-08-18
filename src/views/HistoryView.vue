<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSpace } from '@/composables/useSpace';
import { useTimeEntries } from '@/composables/useTimeEntries';
import { useProjects } from '@/composables/useProjects';
import EditEntryModal from '@/components/history/EditEntryModal.vue';
import BaseSelect from '@/components/common/BaseSelect.vue';
import { formatTimeHHMM, formatDateShort, formatDurationMinutes, calculateDurationMinutes } from '@/lib/utils';
import type { TimeEntry, Project } from '@/types';
import { History, Pencil, Trash2, Calendar, Folder } from 'lucide-vue-next';

const { currentSpace } = useSpace();
const { userEntries, isLoadingEntries, fetchUserEntries, deleteEntry } = useTimeEntries();
const { projects, fetchProjects } = useProjects();

const filterProject = ref('');
const selectedEntryForEdit = ref<TimeEntry | null>(null);
const isEditModalOpen = ref(false);
const isDeletingId = ref<string | null>(null);

onMounted(async () => {
  if (currentSpace.value) {
    await fetchProjects(currentSpace.value.id);
    await fetchUserEntries(currentSpace.value.id);
  }
});

const projectOptions = computed(() => [
  { value: '', label: 'All Projects' },
  ...projects.value.map((p: Project) => ({ value: p.id, label: p.name })),
]);

const filteredEntries = computed(() => {
  if (!filterProject.value) return userEntries.value;
  return userEntries.value.filter((e: TimeEntry) => e.project_id === filterProject.value);
});

// Group entries by date
const groupedEntries = computed(() => {
  const groups: Record<string, TimeEntry[]> = {};
  filteredEntries.value.forEach((entry: TimeEntry) => {
    const dateKey = entry.started_at ? entry.started_at.split('T')[0] : 'Unknown Date';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(entry);
  });
  return groups;
});

function handleEdit(entry: TimeEntry) {
  selectedEntryForEdit.value = entry;
  isEditModalOpen.value = true;
}

async function handleDelete(id: string) {
  if (confirm('Are you sure you want to delete this time entry?')) {
    isDeletingId.value = id;
    await deleteEntry(id);
    isDeletingId.value = null;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-12">
    <!-- Header & Filter -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-neutral-950 flex items-center gap-2">
          <History class="w-5 h-5 text-neutral-700" />
          <span>Your Time History</span>
        </h1>
        <p class="text-xs text-neutral-500">View and manage your recorded time entries.</p>
      </div>

      <div class="w-full sm:w-48">
        <BaseSelect v-model="filterProject" :options="projectOptions" placeholder="Filter by Project" />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoadingEntries" class="py-12 text-center text-xs text-neutral-400">
      Loading your time history...
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredEntries.length === 0"
      class="py-12 bg-white border border-neutral-200 rounded-lg text-center space-y-2"
    >
      <p class="text-xs text-neutral-600 font-semibold">No time entries recorded yet.</p>
      <p class="text-[11px] text-neutral-400">Your completed time intervals will appear here.</p>
    </div>

    <!-- Grouped Entries List -->
    <div v-else class="space-y-6">
      <div
        v-for="(entries, dateStr) in groupedEntries"
        :key="dateStr"
        class="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-xs"
      >
        <div class="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200 flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-semibold text-neutral-900 font-mono">
            <Calendar class="w-3.5 h-3.5 text-neutral-500" />
            <span>{{ formatDateShort(dateStr) }}</span>
            <span class="text-neutral-400 font-sans font-normal text-[11px]">({{ dateStr }})</span>
          </div>

          <span class="text-xs font-mono font-semibold text-neutral-700">
            Total:
            {{
              formatDurationMinutes(
                entries.reduce(
                  (acc, e) => acc + calculateDurationMinutes(e.started_at, e.ended_at),
                  0
                )
              )
            }}
          </span>
        </div>

        <div class="divide-y divide-neutral-100">
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50/50 transition-colors text-xs"
          >
            <!-- Time Interval & Duration -->
            <div class="flex items-center gap-4">
              <div class="font-mono text-neutral-600 min-w-[110px]">
                <span>{{ formatTimeHHMM(entry.started_at) }}</span>
                <span class="text-neutral-300 mx-1">—</span>
                <span>{{ entry.ended_at ? formatTimeHHMM(entry.ended_at) : 'Active' }}</span>
              </div>

              <div class="font-mono font-semibold text-neutral-950 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                {{ formatDurationMinutes(calculateDurationMinutes(entry.started_at, entry.ended_at)) }}
              </div>
            </div>

            <!-- Project, Task, Notes -->
            <div class="flex-1 min-w-0 sm:px-4">
              <div class="font-semibold text-neutral-900 flex items-center gap-1.5">
                <Folder class="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span class="truncate">{{ entry.projects?.name || 'Project' }}</span>
                <span v-if="entry.tasks?.name" class="text-neutral-400 font-normal">/</span>
                <span v-if="entry.tasks?.name" class="text-neutral-600 font-normal truncate">{{ entry.tasks.name }}</span>
              </div>
              <p v-if="entry.notes" class="text-[11px] text-neutral-500 italic mt-0.5 truncate">
                "{{ entry.notes }}"
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 pt-1 sm:pt-0">
              <button
                @click="handleEdit(entry)"
                class="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded transition-colors"
                title="Edit entry"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>

              <button
                @click="handleDelete(entry.id)"
                :disabled="isDeletingId === entry.id"
                class="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete entry"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Entry Modal -->
    <EditEntryModal
      :is-open="isEditModalOpen"
      :entry="selectedEntryForEdit"
      @close="isEditModalOpen = false"
    />
  </div>
</template>
