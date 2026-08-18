<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useSpace } from '@/composables/useSpace';
import { ArrowRight, Crown, Trash2 } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();
const { user } = useAuth();
const { userSpaces, createSpace, joinSpace, deleteSpace, isLoadingSpaces, spaceError, fetchUserSpaces, selectSpace } = useSpace();

const activeTab = ref<'create' | 'join'>('create');
const spaceNameInput = ref('');
const joinCodeInput = ref('');
const localError = ref<string | null>(null);

onMounted(async () => {
  await fetchUserSpaces();
  if (route.query.action === 'join') {
    activeTab.value = 'join';
  } else if (route.query.action === 'create') {
    activeTab.value = 'create';
  }
});

async function handleCreateSpace() {
  localError.value = null;
  if (!spaceNameInput.value.trim()) {
    localError.value = 'Please enter a space name';
    return;
  }

  const space = await createSpace(spaceNameInput.value);
  if (space) {
    spaceNameInput.value = '';
    router.push('/');
  } else {
    localError.value = spaceError.value || 'Failed to create space';
  }
}

async function handleJoinSpace() {
  localError.value = null;
  if (!joinCodeInput.value.trim()) {
    localError.value = 'Please enter a space join code';
    return;
  }

  const space = await joinSpace(joinCodeInput.value);
  if (space) {
    joinCodeInput.value = '';
    router.push('/');
  } else {
    localError.value = spaceError.value || 'Invalid or expired space code';
  }
}

function handleSelectExistingSpace(space: any) {
  selectSpace(space);
  router.push('/');
}

async function handleDeleteSpace(spaceId: string, spaceName: string) {
  localError.value = null;
  const confirmed = window.confirm(`Are you sure you want to delete the space "${spaceName}"? All members, projects, and time entries in this space will be permanently deleted.`);
  if (!confirmed) return;

  const success = await deleteSpace(spaceId);
  if (!success) {
    localError.value = spaceError.value || 'Failed to delete space';
  }
}
</script>

<template>
  <div class="fixed inset-0 z-30 bg-[#161618] text-white overflow-y-auto font-sans selection:bg-[#5bb8f5]">
    <div class="min-h-full w-full flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      <!-- Glow ambient background -->
      <div class="absolute -bottom-36 -right-36 w-[38rem] h-[38rem] bg-indigo-600/20 rounded-full blur-[130px] pointer-events-none"></div>
      <div class="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-400/20 rounded-full blur-[110px] pointer-events-none"></div>

      <div class="w-full max-w-md space-y-4 relative z-10">
        <!-- Hero Rocket Header -->
        <div class="text-center flex justify-center py-2">
          <svg
            class="w-10 h-10"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="tim3-rocket-gradient"
                gradientUnits="userSpaceOnUse"
                x1="2"
                y1="12"
                x2="22"
                y2="12"
              >
                <stop offset="0%" stop-color="#5bb8f5" />
                <stop offset="100%" stop-color="#f43f5e" />
              </linearGradient>
            </defs>
            <path
              d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
              stroke="url(#tim3-rocket-gradient)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"
              stroke="url(#tim3-rocket-gradient)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"
              stroke="url(#tim3-rocket-gradient)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"
              stroke="url(#tim3-rocket-gradient)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="15" cy="9" r="1" fill="url(#tim3-rocket-gradient)" />
          </svg>
        </div>

        <!-- Segmented Pill Tab Switcher Card -->
        <div class="bg-[#252525] p-1.5 rounded-lg flex items-center gap-1">
          <button
            @click="activeTab = 'create'"
            class="flex-1 py-2 font-bold rounded-lg transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95"
            :class="
              activeTab === 'create'
                ? 'bg-[#161618] text-[#5bb8f5]'
                : 'text-[#888888] hover:text-white'
            "
          >
            <span>Create</span>
          </button>
          <button
            @click="activeTab = 'join'"
            class="flex-1 py-2 font-bold rounded-lg transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-95"
            :class="
              activeTab === 'join'
                ? 'bg-[#161618] text-[#5bb8f5]'
                : 'text-[#888888] hover:text-white'
            "
          >
            <span>Join</span>
          </button>
        </div>

        <!-- Error Notification -->
        <div v-if="localError || spaceError" class="p-3 bg-red-950/80 border border-red-800 text-xs text-red-300 rounded-lg flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
          <span>{{ localError || spaceError }}</span>
        </div>

        <!-- Main Form Card -->
        <div class="bg-[#252525] p-4 rounded-lg space-y-3">
          <!-- CREATE SPACE FORM -->
          <div v-if="activeTab === 'create'">
            <form @submit.prevent="handleCreateSpace" class="flex gap-2 items-center">
              <input
                v-model="spaceNameInput"
                type="text"
                placeholder="Space name..."
                required
                class="flex-1 min-w-0 h-10 bg-[#161618] text-white uppercase rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666]"
              />

              <button
                type="submit"
                :disabled="isLoadingSpaces"
                class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50"
                title="Create space"
              >
                <ArrowRight class="w-7 h-7" />
              </button>
            </form>
          </div>

          <!-- JOIN SPACE FORM -->
          <div v-else>
            <form @submit.prevent="handleJoinSpace" class="flex gap-2 items-center">
              <input
                v-model="joinCodeInput"
                type="text"
                placeholder="Space code..."
                required
                class="flex-1 min-w-0 h-10 bg-[#161618] text-white uppercase rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666]"
              />

              <button
                type="submit"
                :disabled="isLoadingSpaces"
                class="p-1.5 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50"
                title="Join space"
              >
                <ArrowRight class="w-7 h-7" />
              </button>
            </form>
          </div>
        </div>

        <!-- Existing Spaces Quick-Switch List -->
        <div v-if="userSpaces.length > 0" class="space-y-2">
          <div class="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1">
            Your Spaces ({{ userSpaces.length }})
          </div>

          <div class="bg-[#252525] p-2 rounded-lg space-y-1">
            <div
              v-for="space in userSpaces"
              :key="space.id"
              @click="handleSelectExistingSpace(space)"
              class="flex items-center justify-between p-3 rounded-lg hover:bg-[#1f1f21] active:scale-[0.99] cursor-pointer transition-all group"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-white truncate group-hover:text-[#5bb8f5] transition-colors flex items-center gap-1.5">
                    <span class="truncate">{{ space.name }}</span>
                    <!-- Owner Crown Icon -->
                    <Crown
                      v-if="space.owner_id === user?.id"
                      class="w-4 h-4 text-amber-400 shrink-0"
                      title="You are the owner of this space"
                    />
                  </div>
                  <div class=" text-[#888888]">
                    Code: <span class="text-white font-medium">{{ space.join_code }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 shrink-0">
                <button
                  v-if="space.owner_id === user?.id"
                  @click.stop="handleDeleteSpace(space.id, space.name)"
                  class=" text-red-600 rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0"
                  title="Delete space"
                >
                  <Trash2 class="w-6 h-6" />
                </button>
                <ArrowRight class="w-6 h-6 text-[#888888] group-hover:text-white transition-colors shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulseBreathe1 {
  0%, 100% {
    transform: translate(0px, 0px) scale(0.9);
    opacity: 0.25;
  }
  50% {
    transform: translate(50px, -40px) scale(1.45);
    opacity: 0.65;
  }
}

@keyframes pulseBreathe2 {
  0%, 100% {
    transform: translate(0px, 0px) scale(1.35);
    opacity: 0.55;
  }
  50% {
    transform: translate(-40px, 50px) scale(0.85);
    opacity: 0.2;
  }
}

@keyframes pulseBreathe3 {
  0%, 100% {
    transform: translate(0px, 0px) scale(0.85);
    opacity: 0.2;
  }
  50% {
    transform: translate(-60px, -30px) scale(1.5);
    opacity: 0.6;
  }
}

@keyframes pulseBreatheCenter {
  0%, 100% {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0.15;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0.5;
  }
}

.animate-pulse-1 {
  animation: pulseBreathe1 7s ease-in-out infinite;
}

.animate-pulse-2 {
  animation: pulseBreathe2 9s ease-in-out infinite;
}

.animate-pulse-3 {
  animation: pulseBreathe3 8s ease-in-out infinite;
}

.animate-pulse-center {
  animation: pulseBreatheCenter 6s ease-in-out infinite;
}
</style>