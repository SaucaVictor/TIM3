<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSpace } from '@/composables/useSpace';
import { ChevronDown, Plus, LogIn, Check } from 'lucide-vue-next';

const router = useRouter();
const { userSpaces, currentSpace, selectSpace } = useSpace();

const isOpen = ref(false);

function handleSelect(space: any) {
  selectSpace(space);
  isOpen.value = false;
}

function handleNavigate(path: string) {
  isOpen.value = false;
  router.push(path);
}
</script>

<template>
  <div class="relative w-full text-left">
    <button
      @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between gap-2 py-1.5 px-3 bg-[#181a1e] border border-[#262930] hover:border-[#5bb8f5]/40 rounded-xl text-sm font-bold text-white transition-colors cursor-pointer"
    >
      <span class="truncate">
        {{ currentSpace ? currentSpace.name : 'Select Space' }}
      </span>

      <ChevronDown class="w-4 h-4 text-[#888888] shrink-0" />
    </button>

    <div
      v-if="isOpen"
      class="fixed inset-0 z-20"
      @click="isOpen = false"
    ></div>

    <div
      v-if="isOpen"
      class="absolute left-0 right-0 mt-1.5 z-30 bg-[#181a1e] border border-[#262930] rounded-xl shadow-2xl py-2 text-xs"
    >
      <div class="px-3 py-1 text-[10px] font-semibold text-[#888888] uppercase tracking-wider font-mono">
        Your Spaces
      </div>

      <div class="max-h-48 overflow-y-auto">
        <button
          v-for="space in userSpaces"
          :key="space.id"
          @click="handleSelect(space)"
          class="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#252525] transition-colors"
          :class="currentSpace?.id === space.id ? 'font-bold text-[#5bb8f5] bg-[#252525]' : 'text-white'"
        >
          <span class="truncate">{{ space.name }}</span>
          <Check v-if="currentSpace?.id === space.id" class="w-3.5 h-3.5 text-[#5bb8f5]" />
        </button>
      </div>

      <div class="border-t border-[#262930] mt-1 pt-1 space-y-0.5">
        <button
          @click="handleNavigate('/spaces?action=create')"
          class="w-full text-left px-3 py-2 flex items-center gap-2 text-neutral-300 hover:bg-[#252525] transition-colors font-medium cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5 text-[#5bb8f5]" />
          <span>Create new space</span>
        </button>

        <button
          @click="handleNavigate('/spaces?action=join')"
          class="w-full text-left px-3 py-2 flex items-center gap-2 text-neutral-300 hover:bg-[#252525] transition-colors font-medium cursor-pointer"
        >
          <LogIn class="w-3.5 h-3.5 text-[#5bb8f5]" />
          <span>Join a space</span>
        </button>
      </div>
    </div>
  </div>
</template>
