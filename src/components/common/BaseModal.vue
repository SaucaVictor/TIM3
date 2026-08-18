<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

interface Props {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs transition-opacity"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-md bg-[#181a1e] border border-[#262930] text-white rounded-2xl shadow-2xl overflow-hidden transform transition-all p-6 space-y-4"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 v-if="title" class="text-base font-semibold text-white tracking-tight">
              {{ title }}
            </h3>
            <p v-if="subtitle" class="text-xs text-[#888888] font-mono mt-0.5">
              {{ subtitle }}
            </p>
          </div>
          <button
            @click="emit('close')"
            class="text-[#888888] hover:text-white p-1 rounded-lg transition-colors hover:bg-[#252525]"
            aria-label="Close modal"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <slot></slot>
        </div>

        <div v-if="$slots.footer" class="flex justify-end gap-2 pt-2 border-t border-[#262930]">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
