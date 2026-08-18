<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import AppHeader from '@/components/layout/AppHeader.vue';

const route = useRoute();
const { isAuthenticated, isSigningOut } = useAuth();
</script>

<template>
  <div class="min-h-full bg-[#0c0d10] text-white flex flex-col font-sans selection:bg-[#5bb8f5]">
    <transition name="csgo-fade">
      <AppHeader v-if="isAuthenticated && !route.meta.public" />
    </transition>

    <main class="flex-1 w-full max-w-full relative">
      <router-view v-slot="{ Component }">
        <transition name="csgo-fade" mode="out-in">
          <component :is="Component" class="" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
/* CS:GO Match Exit / Menu Entrance Cinematic Smooth Transition */
.csgo-fade-enter-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.csgo-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.7, 0, 0.84, 0), transform 0.25s cubic-bezier(0.7, 0, 0.84, 0);
}
.csgo-fade-enter-from {
  opacity: 0;
  transform: scale(0.985);
}
.csgo-fade-leave-to {
  opacity: 0;
  transform: scale(1.015);
}
</style>
