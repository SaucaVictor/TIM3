<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSpace } from '@/composables/useSpace';
import { useTeams } from '@/composables/useTeams';
import { calculateAge, formatDob } from '@/lib/billing';
import {
  Users2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Calendar,
  Sparkles,
  UserCheck,
  ShieldAlert,
} from 'lucide-vue-next';
import type { SpaceTeam, SpaceMember } from '@/types';

const { currentSpace, spaceMembers, fetchSpaceMembers, isOwner } = useSpace();
const {
  teams,
  isLoadingTeams,
  fetchTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  getMembersForAgeRule,
  syncTeamMembers,
} = useTeams();

const isModalOpen = ref(false);
const editingTeamId = ref<string | null>(null);

// Form state
const formName = ref('');
const formMinAge = ref<number | null>(null);
const formMaxAge = ref<number | null>(null);
const formSelectedMemberIds = ref<string[]>([]);
const isSaving = ref(false);
const formError = ref<string | null>(null);
const syncMessage = ref<string | null>(null);

onMounted(async () => {
  if (currentSpace.value) {
    await Promise.all([
      fetchSpaceMembers(currentSpace.value.id),
      fetchTeams(currentSpace.value.id),
    ]);
  }
});

function openCreateModal() {
  editingTeamId.value = null;
  formName.value = '';
  formMinAge.value = null;
  formMaxAge.value = null;
  formSelectedMemberIds.value = [];
  formError.value = null;
  isModalOpen.value = true;
}

function openEditModal(team: SpaceTeam) {
  editingTeamId.value = team.id;
  formName.value = team.name;
  formMinAge.value = team.min_age ?? null;
  formMaxAge.value = team.max_age ?? null;
  formSelectedMemberIds.value = [...team.member_ids];
  formError.value = null;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingTeamId.value = null;
}

// Preset application
function applyPreset(preset: 'u16' | 'u20' | 'o20' | 'custom') {
  if (preset === 'u16') {
    formName.value = 'U16';
    formMinAge.value = 12;
    formMaxAge.value = 15;
  } else if (preset === 'u20') {
    formName.value = 'U20+';
    formMinAge.value = 16;
    formMaxAge.value = 20;
  } else if (preset === 'o20') {
    formName.value = 'O20';
    formMinAge.value = 21;
    formMaxAge.value = null;
  } else {
    formMinAge.value = null;
    formMaxAge.value = null;
  }
  autoSelectMatchingMembers();
}

function autoSelectMatchingMembers() {
  const matching = getMembersForAgeRule(spaceMembers.value, formMinAge.value, formMaxAge.value);
  // Add matching to existing selection
  const set = new Set([...formSelectedMemberIds.value, ...matching]);
  formSelectedMemberIds.value = Array.from(set);
}

function toggleMemberSelection(userId: string) {
  const idx = formSelectedMemberIds.value.indexOf(userId);
  if (idx === -1) {
    formSelectedMemberIds.value.push(userId);
  } else {
    formSelectedMemberIds.value.splice(idx, 1);
  }
}

async function handleSaveTeam() {
  if (!formName.value.trim()) {
    formError.value = 'Team name is required';
    return;
  }

  isSaving.value = true;
  formError.value = null;

  try {
    if (editingTeamId.value) {
      await updateTeam(editingTeamId.value, {
        name: formName.value.trim(),
        min_age: formMinAge.value,
        max_age: formMaxAge.value,
        member_ids: formSelectedMemberIds.value,
      });
    } else {
      await createTeam({
        name: formName.value.trim(),
        min_age: formMinAge.value,
        max_age: formMaxAge.value,
        member_ids: formSelectedMemberIds.value,
      });
    }
    closeModal();
  } catch (err: any) {
    formError.value = err.message || 'Failed to save team';
  } finally {
    isSaving.value = false;
  }
}

async function handleDeleteTeam(teamId: string, teamName: string) {
  if (confirm(`Are you sure you want to delete team "${teamName}"?`)) {
    await deleteTeam(teamId);
  }
}

async function handleSyncTeam(team: SpaceTeam) {
  const added = await syncTeamMembers(team.id, spaceMembers.value);
  syncMessage.value = added > 0
    ? `Synced ${team.name}: added ${added} new member${added > 1 ? 's' : ''}!`
    : `Synced ${team.name}: all qualifying members are already included.`;
  setTimeout(() => {
    syncMessage.value = null;
  }, 3500);
}

function getTeamMembersList(team: SpaceTeam): SpaceMember[] {
  return spaceMembers.value.filter((m) => team.member_ids.includes(m.user_id));
}

function formatAgeRuleBadge(team: SpaceTeam): string {
  if (team.min_age != null && team.max_age != null) {
    return `Ages ${team.min_age} - ${team.max_age}`;
  } else if (team.min_age != null) {
    return `Ages ${team.min_age}+`;
  } else if (team.max_age != null) {
    return `Up to ${team.max_age} yrs`;
  }
  return 'Custom';
}

function doesMemberQualify(member: SpaceMember, minAge?: number | null, maxAge?: number | null): boolean {
  if (minAge == null && maxAge == null) return false;
  const age = calculateAge(member.profiles?.dob);
  if (age == null) return false;
  if (minAge != null && age < minAge) return false;
  if (maxAge != null && age > maxAge) return false;
  return true;
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 pb-24">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 pt-2">
      <h1 class="text-2xl font-bold text-white tracking-tight">
        Teams
      </h1>

      <button
        @click="openCreateModal"
        class="p-2.5 font-bold text-white hover:text-[#5bb8f5] border border-[#333333] active:scale-95 bg-[#161618] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 text-xs sm:text-sm"
      >
        <Plus class="w-5 h-5 text-[#5bb8f5]" />
      </button>
    </div>

    <!-- Sync Toast Alert -->
    <div
      v-if="syncMessage"
      class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-xs flex items-center gap-2 transition-all"
    >
      <Check class="w-4 h-4 text-emerald-400 shrink-0" />
      <span>{{ syncMessage }}</span>
    </div>

    <!-- Teams Grid -->
    <div v-if="teams.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="team in teams"
        :key="team.id"
        class="bg-[#1e1e20] border border-[#333333] rounded-lg p-4 sm:p-5 space-y-4 shadow-xl flex flex-col justify-between"
      >
        <div class="space-y-3">
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <h2 class="text-xl font-bold text-white line-clamp-2 truncate">
                {{ team.name }}
              </h2>
              <div class="flex items-center gap-2 pt-1 flex-wrap">
                <span class="inline-flex items-center px-2 py-0.5 rounded-sm text-sm font-semibold bg-[#5bb8f5]/10 ">
                  {{ formatAgeRuleBadge(team) }}
                </span>
                <span class="text-[#888888]">
                  {{ team.member_ids.length }} {{ team.member_ids.length === 1 ? 'member' : 'members' }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button
                @click="handleSyncTeam(team)"
                class="p-1.5 text-[#888888] hover:text-white hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
                title="Sync"
              >
                <RefreshCw class="w-5 h-5" />
              </button>
              <button
                @click="openEditModal(team)"
                class="p-1.5 text-[#888888] hover:text-white hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
                title="Edit"
              >
                <Pencil class="w-5 h-5" />
              </button>
              <button
                @click="handleDeleteTeam(team.id, team.name)"
                class="p-1.5 text-[#888888] hover:text-rose-400 hover:bg-[#252525] rounded-lg transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Members List -->
          <div class="space-y-1.5 pt-2">
            <div v-if="team.member_ids.length > 0" class="space-y-1 max-h-48 overflow-y-auto pr-1">
              <div
                v-for="m in getTeamMembersList(team)"
                :key="m.id"
                class="flex items-center justify-between py-1"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <div
                    v-if="m.profiles?.avatar_url"
                    class="w-10 h-10 rounded-full overflow-hidden bg-[#2a2a2d] border border-[#444444] shrink-0"
                  >
                    <img :src="m.profiles.avatar_url" alt="" class="w-full h-full object-cover" />
                  </div>
                  <div
                    v-else
                    class="w-10 h-10 rounded-full bg-linear-to-br from-[#5bb8f5]/20 to-[#3b82f6]/20 border border-[#5bb8f5]/30 text-[#5bb8f5] font-bold flex items-center justify-center shrink-0 text-sm"
                  >
                    {{ m.profiles?.full_name?.[0] || '' }}
                  </div>
                  <span class="text-white truncate font-medium">
                    {{ m.profiles?.full_name || m.profiles?.email }}
                  </span>
                </div>

                <div class="text-white shrink-0 text-sm">
                  <span v-if="calculateAge(m.profiles?.dob) != null">
                    {{ calculateAge(m.profiles?.dob) }}y
                  </span>
                  <span v-else class="text-[#555555]">-</span>
                </div>
              </div>
            </div>

            <div v-else class="text-xs text-[#666666] italic py-2">
              No members assigned yet.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!isLoadingTeams"
      class="bg-[#1e1e20] border border-[#333333]/50 rounded-lg p-10 text-center space-y-3 max-w-sm mx-auto my-12"
    >
      <div class="w-12 h-12 rounded-lg bg-[#252525] border border-[#333333] text-[#888888] flex items-center justify-center mx-auto shadow-inner">
        <Users2 class="w-6 h-6 opacity-40" />
      </div>
      <div class="space-y-1">
        <h3 class="text-base font-bold text-white">
          No teams yet
        </h3>
        <p class="text-xs text-[#888888]">
          Organize members into groups for bulk approvals.
        </p>
      </div>
      <button
        @click="openCreateModal"
        class="h-9 px-4 font-bold text-white hover:text-[#5bb8f5] border border-[#333333] active:scale-95 bg-[#161618] hover:bg-[#252525] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs mx-auto"
      >
        <Plus class="w-4 h-4 text-[#5bb8f5]" />
        <span>New Team</span>
      </button>
    </div>

    <!-- Create / Edit Team Modal -->
    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
        @click.self="closeModal"
      >
        <div class="bg-[#1e1e20] border border-[#333333] rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-3 border-b border-[#2a2a2d]">
            <h2 class="text-lg font-bold text-white">
              {{ editingTeamId ? 'Edit Team' : 'Create Team' }}
            </h2>
            <button
              @click="closeModal"
              class="p-1 text-[#888888] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="overflow-y-auto space-y-4 flex-1 pr-1">
            <!-- Error Alert -->
            <div
              v-if="formError"
              class="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-lg text-xs flex items-center gap-2"
            >
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>{{ formError }}</span>
            </div>

            <!-- Presets -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Quick Presets
              </label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  @click="applyPreset('u16')"
                  class="p-2 rounded-lg bg-[#252525] hover:bg-[#2e2e33] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all text-center cursor-pointer"
                >
                  U16 (12-15)
                </button>
                <button
                  type="button"
                  @click="applyPreset('u20')"
                  class="p-2 rounded-lg bg-[#252525] hover:bg-[#2e2e33] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all text-center cursor-pointer"
                >
                  U20+ (16-20)
                </button>
                <button
                  type="button"
                  @click="applyPreset('o20')"
                  class="p-2 rounded-lg bg-[#252525] hover:bg-[#2e2e33] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all text-center cursor-pointer"
                >
                  O20 (20+)
                </button>
                <button
                  type="button"
                  @click="applyPreset('custom')"
                  class="p-2 rounded-lg bg-[#252525] hover:bg-[#2e2e33] border border-[#333333] text-xs font-bold text-white hover:text-[#5bb8f5] transition-all text-center cursor-pointer"
                >
                  Custom
                </button>
              </div>
            </div>

            <!-- Team Name -->
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                Team Name *
              </label>
              <input
                v-model="formName"
                type="text"
                placeholder="e.g. U16, U20+, Developers"
                class="w-full bg-[#161618] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#5bb8f5]"
              />
            </div>

            <!-- Age Rule Range -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                  Age Rule (Optional)
                </label>
                <button
                  type="button"
                  @click="autoSelectMatchingMembers"
                  class="text-xs text-[#5bb8f5] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles class="w-3 h-3" />
                  <span>Auto-select matching</span>
                </button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-[11px] text-[#888888] block mb-1">Min Age</span>
                  <input
                    v-model.number="formMinAge"
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g. 12"
                    class="w-full bg-[#161618] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#5bb8f5]"
                  />
                </div>
                <div>
                  <span class="text-[11px] text-[#888888] block mb-1">Max Age</span>
                  <input
                    v-model.number="formMaxAge"
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g. 15"
                    class="w-full bg-[#161618] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666666] focus:outline-none focus:border-[#5bb8f5]"
                  />
                </div>
              </div>
            </div>

            <!-- Participants Checklist -->
            <div class="space-y-2 pt-2 border-t border-[#2a2a2d]">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-[#888888] uppercase tracking-wider">
                  Participants ({{ formSelectedMemberIds.length }} selected)
                </label>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="formSelectedMemberIds = spaceMembers.map((m) => m.user_id)"
                    class="text-[11px] text-[#5bb8f5] hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span class="text-[#444444]">|</span>
                  <button
                    type="button"
                    @click="formSelectedMemberIds = []"
                    class="text-[11px] text-[#888888] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                <div
                  v-for="member in spaceMembers"
                  :key="member.id"
                  @click="toggleMemberSelection(member.user_id)"
                  class="flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer"
                  :class="
                    formSelectedMemberIds.includes(member.user_id)
                      ? 'bg-[#1a2530] border-[#5bb8f5]/50'
                      : 'bg-[#161618] border-[#262628] hover:border-[#333333]'
                  "
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      :checked="formSelectedMemberIds.includes(member.user_id)"
                      @click.stop="toggleMemberSelection(member.user_id)"
                      class="rounded border-[#444444] text-[#5bb8f5] focus:ring-0 cursor-pointer"
                    />

                    <div class="min-w-0">
                      <div class="text-xs font-bold text-white truncate">
                        {{ member.profiles?.full_name || member.profiles?.email }}
                      </div>
                      <div class="text-[11px] text-[#888888] truncate">
                        {{ member.profiles?.email }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      v-if="doesMemberQualify(member, formMinAge, formMaxAge)"
                      class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    >
                      Qualifies
                    </span>
                    <span class="text-xs text-[#888888] font-mono">
                      {{ calculateAge(member.profiles?.dob) != null ? `${calculateAge(member.profiles?.dob)} yrs` : 'No DOB' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="flex items-center justify-end gap-3 pt-3 border-t border-[#2a2a2d]">
            <button
              type="button"
              @click="closeModal"
              class="px-4 py-2 rounded-lg text-sm text-[#888888] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSaveTeam"
              :disabled="isSaving"
              class="px-5 py-2 rounded-lg bg-[#5bb8f5] text-black font-bold text-sm hover:bg-[#7ac0e3] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {{ isSaving ? 'Saving...' : editingTeamId ? 'Update Team' : 'Create Team' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
