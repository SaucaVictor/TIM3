<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSpace } from '@/composables/useSpace';
import { useTeams } from '@/composables/useTeams';
import { useSwipeGesture } from '@/composables/useSwipeGesture';
import { calculateAge } from '@/lib/billing';
import type { SpaceTeam, SpaceMember } from '@/types';
import {
  X,
  ChevronLeft,
  Users2,
  Users,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  Check,
  RefreshCw,
  Sparkles,
  Settings,
  ShieldAlert,
  AlertCircle,
} from 'lucide-vue-next';

interface Props {
  isOpen: boolean;
  teamId?: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'update:teamId', 'select-team']);

const router = useRouter();
const route = useRoute();
const { currentSpace, isOwner, spaceMembers } = useSpace();
const {
  teams,
  isLoadingTeams,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  syncTeamMembers,
  getMembersForAgeRule,
} = useTeams();

const mainPanelRef = ref<HTMLElement | null>(null);
const contentScrollRef = ref<HTMLElement | null>(null);

// Active team ID selected within the slideover
const currentSelectedTeamId = ref<string | null>(props.teamId || null);

// Active Tab when viewing a team: 'members' | 'rules' | 'settings'
type TeamTabType = 'members' | 'rules' | 'settings';
const activeTab = ref<TeamTabType>('members');

// Quick Create / Add Team state in the list view
const newTeamName = ref('');
const isCreatingTeam = ref(false);

// Team rename state in header
const isEditingTeamName = ref(false);
const editTeamNameInput = ref('');

// Age rule form state for selected team
const editMinAge = ref<number | null>(null);
const editMaxAge = ref<number | null>(null);
const isSavingAgeRule = ref(false);
const syncToastMessage = ref<string | null>(null);

// Member filter in team view
const memberSearchQuery = ref('');

// Swipe gesture to close
useSwipeGesture(mainPanelRef, {
  onSwipeRight: () => {
    if (props.isOpen) {
      handleClose();
    }
  },
});

// Sync prop teamId to internal state
watch(
  () => props.teamId,
  (newId) => {
    currentSelectedTeamId.value = newId || null;
    initTeamForm();
  }
);

// Current selected team object
const activeTeam = computed<SpaceTeam | null>(() => {
  if (!currentSelectedTeamId.value) return null;
  return teams.value.find((t) => t.id === currentSelectedTeamId.value) || null;
});

function initTeamForm() {
  if (activeTeam.value) {
    editTeamNameInput.value = activeTeam.value.name;
    editMinAge.value = activeTeam.value.min_age ?? null;
    editMaxAge.value = activeTeam.value.max_age ?? null;
  }
  isEditingTeamName.value = false;
  activeTab.value = 'members';
}

watch(activeTeam, () => {
  initTeamForm();
});

// Scroll to top when opening or switching teams
watch([() => props.isOpen, currentSelectedTeamId], async () => {
  await nextTick();
  if (contentScrollRef.value) {
    contentScrollRef.value.scrollTop = 0;
  }
  if (mainPanelRef.value) {
    mainPanelRef.value.scrollTop = 0;
  }
});

// Route & Query Synchronization + Scroll Lock
watch(
  () => props.isOpen,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      if (currentSpace.value) {
        await fetchTeams(currentSpace.value.id);
      }
    } else {
      if (route.query.team) {
        const query = { ...route.query };
        delete query.team;
        delete query.teamsDrawer;
        router.replace({ query });
      }
    }
  }
);

function handleClose() {
  currentSelectedTeamId.value = null;
  isEditingTeamName.value = false;
  activeTab.value = 'members';
  emit('close');
  if (route.query.team || route.query.teamsDrawer) {
    const query = { ...route.query };
    delete query.team;
    delete query.teamsDrawer;
    router.replace({ query });
  }
}

function handleBackToList() {
  currentSelectedTeamId.value = null;
  isEditingTeamName.value = false;
  emit('update:teamId', null);
  if (route.query.team) {
    const query = { ...route.query };
    delete query.team;
    router.replace({ query });
  }
}

function selectTeam(team: SpaceTeam) {
  currentSelectedTeamId.value = team.id;
  emit('select-team', team);
  emit('update:teamId', team.id);
  router.replace({ query: { ...route.query, team: team.id } });
}

// Quick Create Team from List
async function handleCreateNewTeam() {
  if (!newTeamName.value.trim() || isCreatingTeam.value) return;
  isCreatingTeam.value = true;
  try {
    const created = await createTeam({
      name: newTeamName.value.trim(),
    });
    newTeamName.value = '';
    if (created) {
      selectTeam(created);
    }
  } finally {
    isCreatingTeam.value = false;
  }
}

// Preset creation
async function handleCreatePresetTeam(preset: 'u16' | 'u20' | 'o20') {
  let name = '';
  let minAge: number | null = null;
  let maxAge: number | null = null;

  if (preset === 'u16') {
    name = 'U16';
    minAge = 12;
    maxAge = 15;
  } else if (preset === 'u20') {
    name = 'U20+';
    minAge = 16;
    maxAge = 20;
  } else if (preset === 'o20') {
    name = 'O20';
    minAge = 21;
    maxAge = null;
  }

  const matchingMemberIds = getMembersForAgeRule(spaceMembers.value, minAge, maxAge);
  const created = await createTeam({
    name,
    min_age: minAge,
    max_age: maxAge,
    member_ids: matchingMemberIds,
  });

  if (created) {
    selectTeam(created);
  }
}

// Inline Rename Team
function startRenameTeam() {
  if (!activeTeam.value) return;
  editTeamNameInput.value = activeTeam.value.name;
  isEditingTeamName.value = true;
}

async function saveRenameTeam() {
  if (!activeTeam.value || !editTeamNameInput.value.trim()) return;
  await updateTeam(activeTeam.value.id, {
    name: editTeamNameInput.value.trim(),
  });
  isEditingTeamName.value = false;
}

// Toggle Member in Active Team
async function toggleMemberInTeam(userId: string) {
  if (!activeTeam.value) return;
  const currentIds = [...activeTeam.value.member_ids];
  const idx = currentIds.indexOf(userId);

  if (idx === -1) {
    currentIds.push(userId);
  } else {
    currentIds.splice(idx, 1);
  }

  await updateTeam(activeTeam.value.id, {
    member_ids: currentIds,
  });
}

// Save Age Rule
async function handleSaveAgeRule() {
  if (!activeTeam.value) return;
  isSavingAgeRule.value = true;
  try {
    await updateTeam(activeTeam.value.id, {
      min_age: editMinAge.value,
      max_age: editMaxAge.value,
    });
    showSyncToast('Age rules saved!');
  } finally {
    isSavingAgeRule.value = false;
  }
}

// Apply Preset to current team
function applyPresetToActiveTeam(preset: 'u16' | 'u20' | 'o20' | 'custom') {
  if (preset === 'u16') {
    editMinAge.value = 12;
    editMaxAge.value = 15;
  } else if (preset === 'u20') {
    editMinAge.value = 16;
    editMaxAge.value = 20;
  } else if (preset === 'o20') {
    editMinAge.value = 21;
    editMaxAge.value = null;
  } else {
    editMinAge.value = null;
    editMaxAge.value = null;
  }
}

// Sync qualifying members
async function handleSyncActiveTeam() {
  if (!activeTeam.value) return;
  const added = await syncTeamMembers(activeTeam.value.id, spaceMembers.value);
  if (added > 0) {
    showSyncToast(`Added ${added} new qualifying member${added > 1 ? 's' : ''}!`);
  } else {
    showSyncToast('All qualifying members are already included.');
  }
}

async function handleQuickSyncTeam(team: SpaceTeam) {
  const added = await syncTeamMembers(team.id, spaceMembers.value);
  if (added > 0) {
    showSyncToast(`Synced ${team.name}: added ${added} member${added > 1 ? 's' : ''}`);
  } else {
    showSyncToast(`Synced ${team.name}: up to date`);
  }
}

function showSyncToast(msg: string) {
  syncToastMessage.value = msg;
  setTimeout(() => {
    syncToastMessage.value = null;
  }, 3000);
}

// Delete Team
async function handleDeleteActiveTeam() {
  if (!activeTeam.value) return;
  if (confirm(`Delete team "${activeTeam.value.name}"?`)) {
    const id = activeTeam.value.id;
    handleBackToList();
    await deleteTeam(id);
  }
}

async function handleQuickDeleteTeam(team: SpaceTeam) {
  if (confirm(`Delete team "${team.name}"?`)) {
    if (currentSelectedTeamId.value === team.id) {
      handleBackToList();
    }
    await deleteTeam(team.id);
  }
}

function getMemberAvatarUrl(m: SpaceMember | any): string | null {
  if (!m) return null;
  const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  return prof?.avatar_url || m.avatar_url || null;
}

function getMemberFullName(m: SpaceMember | any): string {
  if (!m) return 'Member';
  const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  return prof?.full_name || prof?.email || m.email || 'Member';
}

function getMemberInitial(m: SpaceMember | any): string {
  const name = getMemberFullName(m);
  return (name.charAt(0) || '?').toUpperCase();
}

function getMemberAge(m: SpaceMember | any): number | null {
  if (!m) return null;
  const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
  return calculateAge(prof?.dob || m.dob);
}

function formatAgeRuleBadge(team: SpaceTeam): string {
  if (team.min_age != null && team.max_age != null) {
    return `${team.min_age} - ${team.max_age} yrs`;
  } else if (team.min_age != null) {
    return `${team.min_age}+ yrs`;
  } else if (team.max_age != null) {
    return `Up to ${team.max_age} yrs`;
  }
  return 'Custom';
}

// Filtered space members for team assignment
const filteredSpaceMembers = computed(() => {
  let list = spaceMembers.value;
  if (memberSearchQuery.value.trim()) {
    const q = memberSearchQuery.value.toLowerCase().trim();
    list = list.filter((m) => {
      const name = (m.profiles?.full_name || '').toLowerCase();
      const email = (m.profiles?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  // Sort: assigned members first, then by name
  return [...list].sort((a, b) => {
    const isAIn = activeTeam.value?.member_ids.includes(a.user_id) ? 1 : 0;
    const isBIn = activeTeam.value?.member_ids.includes(b.user_id) ? 1 : 0;
    if (isAIn !== isBIn) return isBIn - isAIn;
    const nameA = a.profiles?.full_name || a.profiles?.email || '';
    const nameB = b.profiles?.full_name || b.profiles?.email || '';
    return nameA.localeCompare(nameB);
  });
});
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

      <!-- Main Slide-Over Panel (Slides in from Right) -->
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-300 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="isOpen"
          ref="mainPanelRef"
          data-slideover="true"
          class="fixed inset-y-0 right-0 max-w-full w-full sm:w-88 md:w-[480px] bg-[#161618] text-white shadow-2xl flex flex-col z-50 border-l border-[#262930] pointer-events-auto select-none"
        >
          <!-- Header Area -->
          <div
            class="px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-2 shrink-0"
            style="padding-top: calc(1.5rem + env(safe-area-inset-top));"
          >
            <!-- Left Action Button: Back or Close -->
            <button
              v-if="activeTeam"
              @click="handleBackToList"
              class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Back to Teams"
            >
              <ChevronLeft class="w-7 h-7" />
            </button>
            <button
              v-else
              @click="handleClose"
              class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Close"
            >
              <X class="w-7 h-7" />
            </button>

            <!-- Center Title -->
            <div class="flex flex-col items-center justify-center w-full min-w-0 px-2">
              <template v-if="activeTeam">
                <!-- Team Name (Editable inline if owner) -->
                <div v-if="!isEditingTeamName" class="flex items-center gap-1.5 max-w-full">
                  <h2 class="text-xl font-bold text-center text-white tracking-tight truncate">
                    {{ activeTeam.name }}
                  </h2>
                  <button
                    v-if="isOwner"
                    @click="startRenameTeam"
                    class="text-[#888888] hover:text-white transition-colors p-1 cursor-pointer ml-1"
                    title="Rename Team"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                </div>

                <!-- Inline Quick Rename Form in Header -->
                <div v-else class="flex items-center gap-1 w-full max-w-xs">
                  <input
                    v-model="editTeamNameInput"
                    type="text"
                    class="h-8 bg-[#252525] border border-[#5bb8f5] rounded px-2 text-white focus:outline-none w-full text-sm"
                    autofocus
                    @keyup.enter="saveRenameTeam"
                  />
                  <button
                    @click="saveRenameTeam"
                    class="p-1.5 bg-[#5bb8f5] text-black rounded hover:bg-[#7ac0e3] transition-colors cursor-pointer shrink-0"
                  >
                    <Check class="w-5 h-5 stroke-3" />
                  </button>
                  <button
                    @click="isEditingTeamName = false"
                    class="p-1.5 bg-[#252525] text-[#888888] hover:text-white rounded transition-colors cursor-pointer shrink-0"
                  >
                    <X class="w-5 h-5" />
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="flex items-center gap-2">
                  <h2 class="text-xl font-bold text-center text-white tracking-tight">
                    Teams
                  </h2>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-[#252525] text-[#888888] font-bold">
                    {{ teams.length }}
                  </span>
                </div>
              </template>
            </div>

            <!-- Right Header Icon / Action -->
            <div class="shrink-0 flex items-center justify-end">
              <button
                v-if="activeTeam"
                @click="handleSyncActiveTeam"
                class="p-1.5 text-[#b3b3b3] border border-[#252525] active:scale-95 hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Sync Members"
              >
                <RefreshCw class="w-7 h-7 text-[#5bb8f5]" />
              </button>
              <div v-else class="p-1.5 text-[#b3b3b3] opacity-60">
                <Users2 class="w-7 h-7" />
              </div>
            </div>
          </div>

          <!-- Toast Alert -->
          <div
            v-if="syncToastMessage"
            class="mx-4 mt-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-lg text-xs flex items-center gap-2 transition-all"
          >
            <Check class="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{{ syncToastMessage }}</span>
          </div>

          <!-- Segmented Tab Navigation (When inspecting a team) -->
          <div v-if="activeTeam" class="px-4 pt-3 pb-1 shrink-0">
            <div class="bg-[#252525] p-1 rounded-lg flex items-center justify-between gap-1">
              <button
                @click="activeTab = 'members'"
                class="flex-1 py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                :class="
                  activeTab === 'members'
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                <Users class="w-5 h-5" />
              </button>

              <button
                @click="activeTab = 'rules'"
                class="flex-1 py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                :class="
                  activeTab === 'rules'
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                <Sparkles class="w-5 h-5" />
              </button>

              <button
                @click="activeTab = 'settings'"
                class="flex-1 py-1.5 font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border"
                :class="
                  activeTab === 'settings'
                    ? 'bg-[#161618] text-white shadow-sm border-[#5bb8f5]/40 text-[#5bb8f5]'
                    : 'text-[#888888] hover:text-white border-transparent hover:bg-[#202022]'
                "
              >
                <Settings class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Body Content Area -->
          <div ref="contentScrollRef" class="flex-1 overflow-y-auto p-4 pb-20">
            <Transition name="csgo-fade" mode="out-in">
              <!-- VIEW 1: TEAMS LIST (When no team selected) -->
              <div v-if="!activeTeam" key="teams-list" class="space-y-4">
                <!-- Inline Add Team Card (Matching ProjectSlideOver Add Task design) -->
                <div class="bg-[#252525] p-3 rounded-lg space-y-3">
                  <div class="flex items-center justify-between">
                    <label class="block font-bold text-white">Create New Team</label>
                  </div>

                  <div class="flex gap-2 items-center">
                    <input
                      v-model="newTeamName"
                      type="text"
                      placeholder="e.g. U16, U20+, Developers..."
                      @keyup.enter="handleCreateNewTeam"
                      class="flex-1 h-10 bg-[#161618] text-white rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666] text-sm"
                    />
                    <button
                      @click="handleCreateNewTeam"
                      :disabled="!newTeamName.trim() || isCreatingTeam"
                      class="p-2 text-[#b3b3b3] border border-[#252525] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50"
                      title="Create Team"
                    >
                      <Plus class="w-6 h-6 text-[#5bb8f5]" />
                    </button>
                  </div>

                  <!-- Quick Presets -->
                  <div class="space-y-1.5 pt-1">
                    <span class="text-[11px] font-bold text-[#888888] uppercase tracking-wider block">
                      Quick Presets
                    </span>
                    <div class="grid grid-cols-3 gap-1.5">
                      <button
                        @click="handleCreatePresetTeam('u16')"
                        class="p-2 bg-[#161618] hover:bg-[#202023] border border-[#333333] rounded-lg text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                      >
                        + U16 (12-15)
                      </button>
                      <button
                        @click="handleCreatePresetTeam('u20')"
                        class="p-2 bg-[#161618] hover:bg-[#202023] border border-[#333333] rounded-lg text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                      >
                        + U20+ (16-20)
                      </button>
                      <button
                        @click="handleCreatePresetTeam('o20')"
                        class="p-2 bg-[#161618] hover:bg-[#202023] border border-[#333333] rounded-lg text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                      >
                        + O20 (21+)
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Teams List Cards -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-[#888888] font-bold px-1">
                    <span class="text-xs uppercase tracking-wider">All Teams</span>
                    <span>{{ teams.length }}</span>
                  </div>

                  <div v-if="isLoadingTeams" class="bg-[#252525] p-8 rounded-lg text-center text-[#888888] italic">
                    Loading teams...
                  </div>

                  <div v-else-if="teams.length === 0" class="bg-[#252525] p-8 rounded-lg text-center text-[#888888] italic space-y-2">
                    <Users2 class="w-8 h-8 text-[#555555] mx-auto" />
                    <div>No teams created yet. Use the presets above to get started.</div>
                  </div>

                  <div v-else class="space-y-2">
                    <div
                      v-for="team in teams"
                      :key="team.id"
                      @click="selectTeam(team)"
                      class="bg-[#252525] border border-[#333333]/50 hover:border-[#5bb8f5]/40 rounded-lg p-3.5 transition-all hover:bg-[#2c2c2c] active:scale-[0.99] cursor-pointer shadow-lg flex items-center justify-between gap-3"
                    >
                      <div class="min-w-0 flex-1 space-y-1">
                        <div class="flex items-center gap-2">
                          <h3 class="font-bold text-white truncate text-base">
                            {{ team.name }}
                          </h3>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-[#5bb8f5]/10 text-[#5bb8f5]">
                            {{ formatAgeRuleBadge(team) }}
                          </span>
                        </div>
                        <div class="text-xs text-[#888888] flex items-center gap-1.5">
                          <span>{{ team.member_ids.length }} {{ team.member_ids.length === 1 ? 'member' : 'members' }}</span>
                        </div>
                      </div>

                      <div @click.stop class="flex items-center gap-1 shrink-0">
                        <button
                          v-if="team.min_age != null || team.max_age != null"
                          @click="handleQuickSyncTeam(team)"
                          class="p-2 text-[#888888] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95"
                          title="Sync Members"
                        >
                          <RefreshCw class="w-4 h-4 text-[#5bb8f5]" />
                        </button>
                        <button
                          @click="selectTeam(team)"
                          class="p-2 text-[#888888] hover:text-white bg-[#1a1a1a] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer active:scale-95"
                          title="Edit Team"
                        >
                          <Pencil class="w-4 h-4" />
                        </button>
                        <button
                          v-if="isOwner"
                          @click="handleQuickDeleteTeam(team)"
                          class="p-2 text-[#888888] hover:text-red-400 bg-[#1a1a1a] hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer active:scale-95"
                          title="Delete Team"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- VIEW 2: TEAM DETAILS (TABBED) -->
              <div v-else key="team-details" class="space-y-4">
                <!-- TAB 1: MEMBERS ASSIGNMENT -->
                <div v-if="activeTab === 'members'" class="space-y-4">
                  <!-- Search space members to assign -->
                  <div class="relative w-full">
                    <input
                      v-model="memberSearchQuery"
                      type="text"
                      placeholder="Search space members..."
                      class="w-full h-10 bg-[#161618] text-white rounded-lg px-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666] text-sm"
                    />
                  </div>

                  <!-- Members List -->
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-[#888888] font-bold px-1">
                      <span class="text-xs uppercase tracking-wider">Assigned Members</span>
                      <span>{{ activeTeam.member_ids.length }} / {{ spaceMembers.length }}</span>
                    </div>

                    <div v-if="filteredSpaceMembers.length === 0" class="bg-[#252525] p-6 rounded-lg text-center text-[#888888] italic">
                      No members match the search.
                    </div>

                    <div v-else class="space-y-1.5">
                      <div
                        v-for="m in filteredSpaceMembers"
                        :key="m.id"
                        @click="toggleMemberInTeam(m.user_id)"
                        class="p-3 bg-[#252525] border rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 hover:bg-[#2c2c2c] active:scale-[0.99]"
                        :class="
                          activeTeam.member_ids.includes(m.user_id)
                            ? 'border-[#5bb8f5]/40 bg-[#252525]'
                            : 'border-[#333333]/40 opacity-75'
                        "
                      >
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            v-if="getMemberAvatarUrl(m)"
                            class="w-10 h-10 rounded-full overflow-hidden bg-[#2a2a2d] border border-[#444444] shrink-0"
                          >
                            <img :src="getMemberAvatarUrl(m)!" alt="" class="w-full h-full object-cover" />
                          </div>
                          <div
                            v-else
                            class="w-10 h-10 rounded-full bg-[#161618] border border-[#333333] flex items-center justify-center font-bold text-white uppercase shrink-0 text-sm"
                          >
                            {{ getMemberInitial(m) }}
                          </div>

                          <div class="min-w-0 flex-1">
                            <div class="font-bold text-white truncate text-sm">
                              {{ getMemberFullName(m) }}
                            </div>
                            <div class="text-xs text-[#888888] flex items-center gap-1.5">
                              <span v-if="getMemberAge(m) != null">
                                {{ getMemberAge(m) }}y
                              </span>
                              <span v-else class="text-[#555555]">No DOB</span>
                            </div>
                          </div>
                        </div>

                        <!-- Assigned Checkbox Indicator -->
                        <div
                          class="w-6 h-6 rounded-md border flex items-center justify-center transition-all shrink-0"
                          :class="
                            activeTeam.member_ids.includes(m.user_id)
                              ? 'bg-[#5bb8f5] border-[#5bb8f5] text-black'
                              : 'border-[#444444] bg-[#161618]'
                          "
                        >
                          <Check v-if="activeTeam.member_ids.includes(m.user_id)" class="w-4 h-4 stroke-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- TAB 2: AGE RULES & AUTO-SYNC -->
                <div v-else-if="activeTab === 'rules'" class="space-y-4">
                  <div class="bg-[#252525] p-4 rounded-lg space-y-4">
                    <div class="font-bold text-white flex items-center justify-between">
                      <span>Age Rule Settings</span>
                      <span class="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold bg-[#5bb8f5]/10 text-[#5bb8f5]">
                        {{ formatAgeRuleBadge(activeTeam) }}
                      </span>
                    </div>

                    <!-- Quick Presets -->
                    <div class="space-y-1.5">
                      <span class="text-xs text-[#888888] font-bold block">Apply Preset</span>
                      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          @click="applyPresetToActiveTeam('u16')"
                          class="p-2 rounded-lg bg-[#161618] hover:bg-[#202024] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                        >
                          U16 (12-15)
                        </button>
                        <button
                          type="button"
                          @click="applyPresetToActiveTeam('u20')"
                          class="p-2 rounded-lg bg-[#161618] hover:bg-[#202024] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                        >
                          U20+ (16-20)
                        </button>
                        <button
                          type="button"
                          @click="applyPresetToActiveTeam('o20')"
                          class="p-2 rounded-lg bg-[#161618] hover:bg-[#202024] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                        >
                          O20 (21+)
                        </button>
                        <button
                          type="button"
                          @click="applyPresetToActiveTeam('custom')"
                          class="p-2 rounded-lg bg-[#161618] hover:bg-[#202024] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all cursor-pointer text-center"
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    <!-- Min & Max Age Inputs -->
                    <div class="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label class="text-xs text-[#888888] font-bold block mb-1">Min Age</label>
                        <input
                          v-model.number="editMinAge"
                          type="number"
                          min="0"
                          max="120"
                          placeholder="e.g. 12"
                          class="w-full h-10 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded-lg px-3 text-white text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label class="text-xs text-[#888888] font-bold block mb-1">Max Age</label>
                        <input
                          v-model.number="editMaxAge"
                          type="number"
                          min="0"
                          max="120"
                          placeholder="e.g. 15"
                          class="w-full h-10 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded-lg px-3 text-white text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <!-- Save Age Rule Button -->
                    <button
                      @click="handleSaveAgeRule"
                      :disabled="isSavingAgeRule"
                      class="w-full h-10 bg-[#5bb8f5] hover:bg-[#7ac0e3] text-black font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      <Check class="w-4 h-4 stroke-3" />
                      <span>Save Age Rule</span>
                    </button>
                  </div>

                  <!-- Auto-Sync Action Card -->
                  <div class="bg-[#252525] p-4 rounded-lg space-y-3">
                    <div class="font-bold text-white">Auto-Sync Members</div>
                    <p class="text-xs text-[#888888]">
                      Scan all space members and automatically add everyone who meets the age rule criteria.
                    </p>
                    <button
                      @click="handleSyncActiveTeam"
                      class="w-full h-10 bg-[#161618] hover:bg-[#202024] text-white border border-[#333333] hover:border-[#5bb8f5] font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-98"
                    >
                      <RefreshCw class="w-4 h-4 text-[#5bb8f5]" />
                      <span>Sync Qualifying Members Now</span>
                    </button>
                  </div>
                </div>

                <!-- TAB 3: SETTINGS -->
                <div v-else-if="activeTab === 'settings'" class="space-y-4">
                  <!-- Rename Team Card -->
                  <div class="bg-[#252525] p-4 rounded-lg space-y-3">
                    <div class="font-bold text-white">Team Name</div>
                    <div class="flex gap-2">
                      <input
                        v-model="editTeamNameInput"
                        type="text"
                        class="flex-1 h-10 bg-[#161618] border border-[#333333] focus:border-[#5bb8f5] rounded-lg px-3 text-white text-sm focus:outline-none"
                      />
                      <button
                        @click="saveRenameTeam"
                        class="px-4 h-10 bg-[#5bb8f5] hover:bg-[#7ac0e3] text-black font-bold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <!-- Danger Zone Card -->
                  <div v-if="isOwner" class="bg-red-950/20 p-4 rounded-lg space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-bold text-red-300">Delete Team</div>
                        <div class="text-xs text-red-400/80">
                          Remove this team. Members won't be deleted.
                        </div>
                      </div>
                      <button
                        @click="handleDeleteActiveTeam"
                        class="p-3 bg-red-900/60 hover:bg-red-800 text-red-200 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                        title="Delete Team"
                      >
                        <Trash2 class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.csgo-fade-enter-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
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
