<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useSpace } from '@/composables/useSpace';
import { useSwipeGesture } from '@/composables/useSwipeGesture';
import {
  Clock,
  BarChart3,
  Folder,
  Users,
  LogOut,
  X,
  Copy,
  Check,
  Pencil,
  Space,
  Home,
  Rocket,
  Loader2,
  Calendar,
} from 'lucide-vue-next';
import { calculateAge, formatDob } from '@/lib/billing';

interface Props {
  isOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

const router = useRouter();
const route = useRoute();
const { profile, signOut, updateProfile, isSigningOut } = useAuth();
const { currentSpace, isOwner, currentRole } = useSpace();

const drawerRef = ref<HTMLElement | null>(null);
const isCopied = ref(false);
const isEditingName = ref(false);
const newNameVal = ref('');
const isSavingName = ref(false);

const isEditingDob = ref(false);
const newDobVal = ref('');
const isSavingDob = ref(false);

const userAge = computed(() => calculateAge(profile.value?.dob));

useSwipeGesture(drawerRef, {
  onSwipeLeft: () => {
    if (props.isOpen) {
      handleClose();
    }
  },
});

const navigationItems = computed(() => {
  const items = [
    { label: 'Time Tracker', path: '/', icon: Clock },
    { label: 'Spaces', path: '/spaces', icon: Rocket },
  ];

  if (isOwner.value) {
    items.push(
      { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
      { label: 'Projects', path: '/projects', icon: Folder },
      { label: 'Members', path: '/members', icon: Users }
    );
  }

  return items;
});

// Mobile Back Button / Route Query Synchronization + body scroll lock
watch(
  () => props.isOpen,
  (open) => {
    // Lock/unlock background scroll
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      if (route.query.menu !== 'open') {
        router.push({ query: { ...route.query, menu: 'open' } });
      }
    } else {
      if (route.query.menu === 'open') {
        const query = { ...route.query };
        delete query.menu;
        router.replace({ query });
      }
    }
  }
);

watch(
  () => route.query.menu,
  (menuQuery) => {
    if (isSigningOut.value) return;
    if (menuQuery !== 'open' && props.isOpen) {
      emit('close');
    }
  }
);

function handleClose() {
  emit('close');
  if (route.query.menu === 'open') {
    router.back();
  }
}

function handleNavigate(path: string) {
  if (route.query.menu === 'open') {
    router.back();
  } else {
    emit('close');
  }
  if (route.path !== path) {
    setTimeout(() => {
      router.push(path);
    }, 50);
  }
}

function copyJoinCode() {
  const code = currentSpace.value?.join_code;
  if (!code) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).catch(() => {
      fallbackCopyTextToClipboard(code);
    });
  } else {
    fallbackCopyTextToClipboard(code);
  }
  isCopied.value = true;
  setTimeout(() => {
    isCopied.value = false;
  }, 2000);
}

function fallbackCopyTextToClipboard(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
}

async function handleSignOut() {
  if (isSigningOut.value) return;
  isSigningOut.value = true;
  await signOut();
  router.push('/login');
}

function startEditingName() {
  newNameVal.value = profile.value?.full_name || '';
  isEditingName.value = true;
}

async function handleSaveName() {
  if (!newNameVal.value.trim()) return;
  isSavingName.value = true;
  await updateProfile({ full_name: newNameVal.value.trim() });
  isSavingName.value = false;
  isEditingName.value = false;
}

function startEditingDob() {
  newDobVal.value = profile.value?.dob || '';
  isEditingDob.value = true;
}

async function handleSaveDob() {
  isSavingDob.value = true;
  let finalDob: string | null = newDobVal.value ? newDobVal.value.trim() : null;

  if (finalDob) {
    const inputDate = new Date(finalDob);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (isNaN(inputDate.getTime()) || inputDate.getTime() > today.getTime()) {
      // Future date: safely fallback to null without errors
      finalDob = null;
    }
  }

  await updateProfile({ dob: finalDob });
  isSavingDob.value = false;
  isEditingDob.value = false;
}

function getUserInitials(): string {
  const name = profile.value?.full_name || profile.value?.email || 'User';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex pointer-events-none"
      :class="{ 'pointer-events-auto': isOpen }"
    >
      <!-- Backdrop Transition -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 bg-black/80 backdrop-blur-xs pointer-events-auto"
          @click="handleClose"
        ></div>
      </Transition>

      <!-- Sidebar Panel Transition (Left-to-Right Entry, Right-to-Left Leave) -->
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        enter-from-class="-translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-300 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="-translate-x-full"
      >
        <div
          v-if="isOpen"
          ref="drawerRef"
          class="fixed inset-y-0 left-0 max-w-full w-full sm:w-88 bg-[#161618] text-white shadow-2xl flex flex-col z-50 border-r border-[#262930] pointer-events-auto"
        >
          <!-- Header / App Branding -->
          <div class="px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-4 shrink-0" style="padding-top: calc(1.5rem + env(safe-area-inset-top));">
            <div class="flex items-center gap-3">
              <span class="text-3xl font-bold text-white tracking-tight">
                <span class="text-white">TIM</span><span class="text-transparent bg-clip-text bg-gradient-to-r from-[#5bb8f5] to-[#f43f5e]">3</span>
              </span>
            </div>

            <button
              @click="handleClose"
              class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Close menu"
            >
              <X class="w-7 h-7" />
            </button>
          </div>

          <!-- Body Content -->
          <div class="p-4 overflow-y-auto flex-1 space-y-4">
            <!-- 1. Profile Summary Card -->
            <div class="bg-[#252525] p-4 rounded-lg space-y-3">
              <!-- Name & Role Row -->
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-full bg-[#5bb8f5]/20 text-[#5bb8f5] font-bold flex items-center justify-center tracking-tight shrink-0 border border-[#5bb8f5]/30">
                  {{ getUserInitials() }}
                </div>

                <div v-if="!isEditingName" class="min-w-0 flex-1">
                  <div class="font-bold text-white truncate">
                    {{ profile?.full_name || profile?.email || 'User' }}
                  </div>
                  <div class="text-[#888888] capitalize">
                    {{ currentRole || 'Member' }}
                  </div>
                </div>

                <div v-else class="flex-1 min-w-0 flex items-center gap-2.5">
                  <input
                    v-model="newNameVal"
                    type="text"
                    placeholder="Your display name"
                    @keydown.enter="handleSaveName"
                    @keydown.escape="isEditingName = false"
                    class="flex-1 min-w-0 h-10 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded-lg px-3 text-white placeholder:text-[#555] focus:outline-none transition-colors"
                    autofocus
                  />
                  <button
                    @click="handleSaveName"
                    :disabled="isSavingName || !newNameVal.trim()"
                    class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center disabled:opacity-50"
                    title="Save name"
                  >
                    <Loader2 v-if="isSavingName" class="w-7 h-7 animate-spin" />
                    <Check v-else class="w-7 h-7" />
                  </button>
                </div>

                <button
                  @click="isEditingName ? isEditingName = false : startEditingName()"
                  class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                  :title="isEditingName ? 'Cancel' : 'Edit name'"
                >
                  <Pencil v-if="!isEditingName" class="w-7 h-7" />
                  <X v-else class="w-7 h-7" />
                </button>
              </div>

              <!-- Date of Birth / Age Row -->
              <div class="pt-1 flex items-center justify-between gap-2">
                <div v-if="!profile?.dob && !isEditingDob" class="flex items-center gap-2 text-[#888888] shrink-0 font-medium">
                  <span class="leading-none">Birthday:</span>
                </div>

                <div v-if="!isEditingDob" class="flex-1 min-w-0 flex items-center gap-2" :class="[ profile?.dob ? 'justify-between' : 'justify-end']">
                  <div class="text-right truncate">
                    <span v-if="profile?.dob" class="text-white font-medium">
                      {{ formatDob(profile.dob) }}
                      <span class="text-[#5bb8f5] font-semibold ml-1">({{ (userAge || 0) >= 0 ? `${userAge} yrs` :  'invalid' }}) </span>
                    </span>
                    <div @click="startEditingDob" v-else class="text-amber-400 px-2 bg-amber-400/10 rounded-lg font-semibold border border-amber-400/20 cursor-pointer">
                      Add your DOB
                    </div>
                  </div>
                  <button
                  v-if="profile?.dob"
                    @click="startEditingDob"
                    class="p-2 text-[#b3b3b3] active:scale-95 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                    :title="profile?.dob ? 'Change birthday' : 'Add birthday'"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                </div>

                <div v-else class="flex-1 min-w-0 flex items-center justify-end gap-1.5">
                  <input
                    v-model="newDobVal"
                    type="date"
                    :max="new Date().toISOString().split('T')[0]"
                    style="color-scheme: dark;"
                    @keydown.enter="handleSaveDob"
                    @keydown.escape="isEditingDob = false"
                    class="flex-1 min-w-0 h-8 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded-md px-2 text-white text-xs focus:outline-none"
                    autofocus
                  />
                  <button
                    @click="handleSaveDob"
                    :disabled="isSavingDob"
                    class="p-2 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center disabled:opacity-50"
                    title="Save birthday"
                  >
                    <Loader2 v-if="isSavingDob" class="w-4 h-4 animate-spin" />
                    <Check v-else class="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    @click="isEditingDob = false"
                    class="p-2 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                    title="Cancel"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. Workspace Info & Invite Code -->
            <div v-if="currentSpace" class="bg-[#252525] p-4 rounded-lg space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="font-bold text-white truncate flex-1 min-w-0">
                  {{ currentSpace.name }}
                </div>

                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="drawer-rocket-grad" gradientUnits="userSpaceOnUse" x1="2" y1="12" x2="22" y2="12">
                      <stop offset="0%" stop-color="#5bb8f5" />
                      <stop offset="100%" stop-color="#f43f5e" />
                    </linearGradient>
                  </defs>
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="url(#drawer-rocket-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" stroke="url(#drawer-rocket-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" stroke="url(#drawer-rocket-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" stroke="url(#drawer-rocket-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  <circle cx="15" cy="9" r="1" fill="url(#drawer-rocket-grad)" />
                </svg>
              </div>

              <div
                v-if="currentSpace?.join_code"
                @click="copyJoinCode"
                class="pt-2 mt-1 border-t border-[#333333] flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                title="Copy invite code"
              >
                <span class="font-mono font-bold text-[#5bb8f5] tracking-wider">{{ currentSpace.join_code }}</span>
                <div class="p-1 text-[#888888]">
                  <Check v-if="isCopied" class="w-4 h-4 text-emerald-400" />
                  <Copy v-else class="w-4 h-4" />
                </div>
              </div>
            </div>

            <!-- 3. Navigation Stack Group Card -->
            <div class="bg-[#252525] p-2 rounded-lg space-y-1">
              <button
                v-for="item in navigationItems"
                :key="item.path"
                @click="handleNavigate(item.path)"
                class="w-full flex items-center gap-3.5 p-3 font-semibold transition-all text-left cursor-pointer rounded-lg active:scale-[0.99]"
                :class="
                  route.path === item.path
                    ? 'bg-[#1f1f21] text-[#5bb8f5]'
                    : 'text-white hover:bg-[#1f1f21] text-neutral-300'
                "
              >
                <component :is="item.icon" class="w-5 h-5 shrink-0" :class="route.path === item.path ? 'text-[#5bb8f5]' : 'text-[#888888]'" />
                <span class="truncate">{{ item.label }}</span>
              </button>
            </div>

            <!-- 4. Account & Sign Out Card Section -->
            <div class="bg-[#252525] p-4 rounded-lg space-y-2">
              <div class="text-[#888888] truncate">
                {{ profile?.email }}
              </div>
              <button
                @click="handleSignOut"
                :disabled="isSigningOut"
                class="w-full bg-[#161618] hover:bg-red-950/40 active:scale-[0.98] border border-red-950/60 p-3 flex items-center gap-3.5 font-semibold text-red-400 rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Loader2 v-if="isSigningOut" class="w-5 h-5 shrink-0 animate-spin" />
                <LogOut v-else class="w-5 h-5 shrink-0" />
                <span>{{ isSigningOut ? 'Signing Out...' : 'Sign Out' }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
