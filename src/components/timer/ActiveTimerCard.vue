<script setup lang="ts">
import { useTimer } from '@/composables/useTimer';
import BaseButton from '@/components/common/BaseButton.vue';
import { Square } from 'lucide-vue-next';

const { activeTimerEntry, formattedElapsed, isTimerLoading, stopTimer } = useTimer();

async function handleStop() {
  await stopTimer();
}
</script>

<template>
  <div
    v-if="activeTimerEntry"
    class="w-full bg-[#252525] border border-[#10b981]/40 rounded-xl px-4 py-4 mt-3 shadow-lg transition-all"
  >
    <div class="flex justify-between items-stretch gap-4">
      <!-- Left Side: Project, Task & Notes -->
      <div class="flex flex-col justify-start flex-1 min-w-0">
        <div class="min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-lg font-bold text-[#10b981] truncate block min-w-0" :class="{ 'italic opacity-50': !activeTimerEntry.projects }">
              {{ activeTimerEntry.projects?.name || 'no project' }}
            </span>
          </div>
          <span class="text-sm text-white font-medium truncate block" :class="{ 'italic opacity-50': !activeTimerEntry.tasks }">
            {{ activeTimerEntry.tasks?.name || '' }}
          </span>
        </div>
        <p v-if="activeTimerEntry.notes" class="text-xs text-[#acacac] font-medium leading-relaxed truncate">
          {{ activeTimerEntry.notes }}
        </p>
      </div>

      <!-- Right Side: Live Elapsed Time & Stop Button -->
      <div class="flex flex-col justify-between items-end shrink-0 self-stretch">
        <span class="text-white font-semibold">
          {{ formattedElapsed }}
        </span>

        <button
          @click="handleStop"
          :disabled="isTimerLoading"
          class="text-red-500 hover:text-red-400 rounded-full transition-colors cursor-pointer  p-2 -mb-2 -mr-2 disabled:opacity-50"
          title="Stop Timer"
        >
          <Square class="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  </div>
</template>
