<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTimer } from '@/composables/useTimer';
import { useSwipeGesture } from '@/composables/useSwipeGesture';
import SidebarDrawer from './SidebarDrawer.vue';
import StatsSlideOver from '@/components/stats/StatsSlideOver.vue';
import { Menu, X, BarChart3 } from 'lucide-vue-next';

const route = useRoute();
const { isTimerRunning, formattedElapsed, stopTimer } = useTimer();
const isDrawerOpen = ref(false);
const isStatsOpen = ref(false);

const isMainPage = computed(() => {
  return route.path === '/' || route.name === 'timer' || !route.name || route.path === '';
});

async function handleStop() {
  await stopTimer();
}

// Synchronize stats open state with route query (only active on main page)
watch(
  () => [route.query.stats, route.path],
  ([statsQuery]) => {
    if (isMainPage.value) {
      isStatsOpen.value = statsQuery === 'open';
    } else {
      isStatsOpen.value = false;
    }
  },
  { immediate: true }
);

useSwipeGesture(null, {
  onSwipeRight: () => {
    // Only open sidebar if drawer is closed AND no slideover panel/modal is active
    const isSlideOverOpen = Boolean(document.querySelector('[data-slideover="true"]'));
    if (!isDrawerOpen.value && !isSlideOverOpen && !isStatsOpen.value) {
      isDrawerOpen.value = true;
    }
  },
});
</script>

<template>
  <header class="sticky top-0 z-40 bg-transparent border-b border-transparent text-white pt-[env(safe-area-inset-top)]">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-4">
      <!-- Left: Drawer Toggle & Title -->
      <div class="flex items-center gap-3">
        <button
          @click="isDrawerOpen = true"
          class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
          title="Open Menu"
        >
          <Menu class="w-7 h-7" />
        </button>
      </div>

      <!-- Right: Active Timer Indicator, Stats Button & User Profile -->
      <div class="flex items-center gap-2.5">
        <router-link
          v-if="isTimerRunning"
          to="/"
          class="flex items-center gap-2 px-2 py-2 bg-red-950 border border-red-700 text-red-300 font-mono font-bold rounded-lg shadow-sm"
        >
          <span class="pl-1">{{ formattedElapsed }}</span>
          <button @click="handleStop" class="p-1 text-white bg-red-800 rounded-lg transition-colors cursor-pointer" title="Stop Timer">
            <X class="w-4 h-4" />
          </button>
        </router-link>

        <button
          v-if="isMainPage"
          @click="isStatsOpen = true"
          class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
          title="Analytics & Stats"
        >
          <BarChart3 class="w-7 h-7" />
        </button>
      </div>
    </div>

    <!-- Sidebar Drawer Component -->
    <SidebarDrawer :is-open="isDrawerOpen" @close="isDrawerOpen = false" />

    <!-- Revolut-Inspired Analytics SlideOver Component -->
    <StatsSlideOver :is-open="isStatsOpen" @close="isStatsOpen = false" />
  </header>
</template>
