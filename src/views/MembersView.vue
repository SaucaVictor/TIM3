<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useSpace } from '@/composables/useSpace';
import { useAuth } from '@/composables/useAuth';
import { formatDateShort } from '@/lib/utils';
import { formatDob, calculateAge } from '@/lib/billing';
import StatsSlideOver from '@/components/stats/StatsSlideOver.vue';
import {
  Search,
  Copy,
  Check,
  ShieldCheck,
  Crown,
  User,
  Trash2,
  Loader2,
  BarChart3,
} from 'lucide-vue-next';
import type { SpaceMember, Role } from '@/types';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const {
  currentSpace,
  spaceMembers,
  fetchSpaceMembers,
  isOwner,
  updateMemberRole,
  removeMember,
} = useSpace();

const searchQuery = ref('');
const isCopied = ref(false);
const updatingMemberId = ref<string | null>(null);

// Member Stats SlideOver state
const isMemberStatsOpen = ref(false);
const selectedMemberForStats = ref<SpaceMember | null>(null);

function openMemberStats(member: SpaceMember) {
  selectedMemberForStats.value = member;
  isMemberStatsOpen.value = true;
}

onMounted(async () => {
  if (currentSpace.value) {
    await fetchSpaceMembers(currentSpace.value.id);

    if (route.query.memberStats) {
      const targetId = route.query.memberStats as string;
      const found = spaceMembers.value.find((m) => m.user_id === targetId || m.id === targetId);
      if (found) {
        selectedMemberForStats.value = found;
        isMemberStatsOpen.value = true;
      }
    }
  }
});

watch(
  () => route.query.memberStats,
  (mId) => {
    if (mId && typeof mId === 'string') {
      const found = spaceMembers.value.find((m) => m.user_id === mId || m.id === mId);
      if (found) {
        selectedMemberForStats.value = found;
        isMemberStatsOpen.value = true;
      }
    } else if (!mId && isMemberStatsOpen.value) {
      isMemberStatsOpen.value = false;
      selectedMemberForStats.value = null;
    }
  }
);

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) return spaceMembers.value;
  const q = searchQuery.value.toLowerCase().trim();
  return spaceMembers.value.filter((m: SpaceMember) => {
    const name = (m.profiles?.full_name || '').toLowerCase();
    const email = (m.profiles?.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });
});

async function copyJoinCode() {
  if (!currentSpace.value?.join_code) return;
  try {
    await navigator.clipboard.writeText(currentSpace.value.join_code);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy join code:', err);
  }
}

async function handleRoleChange(member: SpaceMember, newRole: Role) {
  if (member.role === newRole) return;
  updatingMemberId.value = member.id;
  try {
    await updateMemberRole(member.id, newRole);
  } finally {
    updatingMemberId.value = null;
  }
}

async function handleRemoveMember(member: SpaceMember) {
  if (!confirm(`Are you sure you want to remove ${member.profiles?.full_name || member.profiles?.email || 'this member'} from the space?`)) {
    return;
  }
  updatingMemberId.value = member.id;
  try {
    await removeMember(member.id);
  } finally {
    updatingMemberId.value = null;
  }
}
</script>

<template>
  <div class="app max-w-3xl mx-auto px-4 sm:px-6 space-y-4" style="padding-bottom: calc(7rem + env(safe-area-inset-bottom));">
    <!-- Heading matching TimerView style -->
    <div class="flex justify-between items-baseline pt-2">
      <span class="text-lg font-bold text-white">Members</span>
      <span class="text-lg font-semibold text-white">{{ spaceMembers.length }}</span>
    </div>

    <!-- Space Join Code Card -->
    <div
      v-if="currentSpace"
      class="bg-[#252525] border border-[#252525] rounded-lg px-4 py-3 flex items-center justify-between gap-3 shadow-lg"
    >
      <div class="min-w-0">
        <div class="font-bold text-[#888888]">Space Code</div>
        <div class="font-mono font-bold text-white tracking-wider truncate">
          {{ currentSpace.join_code }}
        </div>
      </div>

      <button
        @click="copyJoinCode"
        class="h-10 px-4 bg-[#161618] hover:bg-[#202124] text-white border border-[#333333] active:scale-95 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 shrink-0"
        title="Copy Space Join Code"
      >
        <Check v-if="isCopied" class="w-5 h-5 text-emerald-400" />
        <Copy v-else class="w-5 h-5 text-[#888888]" />
        <span>{{ isCopied ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>

    <!-- Search Input -->
    <div class="relative w-full">
      <Search class="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search members..."
        class="w-full h-10 bg-[#161618] text-white rounded-lg pl-9 pr-3 border border-[#333333] focus:border-[#5bb8f5] focus:outline-none placeholder:text-[#666666] transition-colors"
      />
    </div>

    <!-- Empty State -->
    <div
      v-if="filteredMembers.length === 0"
      class="py-10 bg-[#252525] border border-[#262930] rounded-lg text-center space-y-3 p-6"
    >
      <div class="font-bold text-white">
        No members found
      </div>
    </div>

    <!-- Members List -->
    <div v-else class="space-y-3">
      <div
        v-for="member in filteredMembers"
        :key="member.id"
        @click="openMemberStats(member)"
        class="bg-[#252525] border border-[#252525] hover:border-[#5bb8f5]/40 rounded-lg p-4 transition-all hover:bg-[#2c2c2c] active:scale-[0.99] cursor-pointer shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
      >
        <!-- Member Avatar & Info (Clickable for Stats) -->
        <div class="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          <div
            class="w-11 h-11 rounded-full bg-[#161618] border border-[#333333] flex items-center justify-center font-bold text-white uppercase shrink-0"
          >
            {{ (member.profiles?.full_name || member.profiles?.email || 'M').charAt(0) }}
          </div>

          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-bold text-white truncate">
                {{ member.profiles?.full_name || 'Member' }}
              </span>
              <span v-if="member.user_id === user?.id" class="text-[#888888] font-bold">
                (You)
              </span>
            </div>

            <div class="text-[#888888] truncate">
              {{ member.profiles?.email }}
            </div>

            <div v-if="isOwner" class="flex items-center gap-1.5 text-[#888888] pt-0.5">
              <span v-if="member.profiles?.dob" class="text-white font-medium">
                {{ formatDob(member.profiles.dob) }}
                <span class="text-[#5bb8f5] font-semibold ml-1">
                  ({{ calculateAge(member.profiles.dob) }} yrs)
                </span>
              </span>
              <span v-else class="text-[#666666] italic">
                No DOB set
              </span>
            </div>
          </div>
        </div>

        <!-- Role & Actions (Mobile responsive bottom row / Desktop right) -->
        <div
          @click.stop
          class="flex items-center justify-between sm:justify-end gap-2.5 pt-2.5 sm:pt-0 border-t border-[#333333]/40 sm:border-t-0 shrink-0"
        >
          <!-- Joined Date (on mobile and desktop) -->
          <span class="text-[#888888] font-medium sm:hidden">
            Joined {{ formatDateShort(member.joined_at) }}
          </span>

          <!-- Owner Editing Member Role -->
          <div v-if="isOwner && member.role !== 'owner' && member.user_id !== user?.id" class="flex items-center gap-2">
            <select
              :value="member.role"
              :disabled="updatingMemberId === member.id"
              @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value as Role)"
              class="h-9 bg-[#161618] text-white border border-[#333333] rounded-lg px-3 focus:border-[#5bb8f5] focus:outline-none cursor-pointer font-bold capitalize"
            >
              <option value="member">Member</option>
              <option value="co-owner">Co-Owner</option>
            </select>

            <button
              @click="handleRemoveMember(member)"
              :disabled="updatingMemberId === member.id"
              class="p-2 text-[#888888] hover:text-red-400 bg-[#161618] hover:bg-[#202124] border border-[#333333] rounded-lg transition-colors cursor-pointer"
              title="Remove Member"
            >
              <Loader2 v-if="updatingMemberId === member.id" class="w-4 h-4 animate-spin text-[#888888]" />
              <Trash2 v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Static Role Badge -->
          <div
            v-else
            class="px-3 py-1 rounded-lg border font-bold capitalize flex items-center gap-1.5 shrink-0"
            :class="{
              'bg-[#5bb8f5]/10 text-[#5bb8f5] border-[#5bb8f5]/30': member.role === 'owner',
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/30': member.role === 'co-owner',
              'bg-[#161618] text-neutral-300 border-[#333333]': member.role === 'member',
            }"
          >
            <Crown v-if="member.role === 'owner'" class="w-4 h-4" />
            <ShieldCheck v-else-if="member.role === 'co-owner'" class="w-4 h-4" />
            <User v-else class="w-4 h-4" />
            <span>{{ member.role === 'co-owner' ? 'Co-Owner' : member.role }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Member Specific Stats SlideOver Component -->
    <StatsSlideOver
      :is-open="isMemberStatsOpen"
      :member="selectedMemberForStats"
      :user-id="selectedMemberForStats?.user_id"
      @close="isMemberStatsOpen = false; selectedMemberForStats = null;"
    />
  </div>
</template>
