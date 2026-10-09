import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useSpace } from './useSpace';
import type { TimeEntry, EntryStatus } from '@/types';

const userEntries = ref<TimeEntry[]>([]);
const spaceTeamEntries = ref<TimeEntry[]>([]);
const activeTimers = ref<TimeEntry[]>([]);
const isLoadingEntries = ref<boolean>(true);
const isLoadingActiveTimers = ref<boolean>(false);
const isLoadingMoreUserEntries = ref<boolean>(false);
const hasMoreUserEntries = ref<boolean>(true);
const isLoadingMoreTeamEntries = ref<boolean>(false);
const hasMoreTeamEntries = ref<boolean>(true);
const entriesError = ref<string | null>(null);

const PAGE_SIZE = 100;
const TEAM_PAGE_SIZE = 1000;

export function useTimeEntries() {
  const { user } = useAuth();
  const { currentSpace, isOwner } = useSpace();

  const todayEntries = computed(() => {
    const today = new Date().toDateString();
    return userEntries.value.filter((entry) => {
      const entryDate = new Date(entry.started_at).toDateString();
      return entryDate === today;
    });
  });

  async function fetchUserEntries(spaceId?: string, isInitial = true) {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!user.value || !targetSpaceId) {
      userEntries.value = [];
      hasMoreUserEntries.value = false;
      return;
    }

    if (isInitial) {
      isLoadingEntries.value = true;
      userEntries.value = [];
    } else {
      if (isLoadingMoreUserEntries.value || !hasMoreUserEntries.value) return;
      isLoadingMoreUserEntries.value = true;
    }

    entriesError.value = null;

    try {
      const from = isInitial ? 0 : userEntries.value.length;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects (*), tasks (*)')
        .eq('space_id', targetSpaceId)
        .eq('user_id', user.value.id)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      const fetched = (data as TimeEntry[]) || [];

      if (isInitial) {
        userEntries.value = fetched;
      } else {
        userEntries.value = [...userEntries.value, ...fetched];
      }

      hasMoreUserEntries.value = fetched.length === PAGE_SIZE;
    } catch (err: any) {
      entriesError.value = err.message || 'Failed to fetch time entries';
    } finally {
      isLoadingEntries.value = false;
      isLoadingMoreUserEntries.value = false;
    }
  }

  async function fetchSpaceTeamEntries(spaceId?: string, isInitial = true) {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!targetSpaceId) return;

    if (isInitial) {
      isLoadingEntries.value = true;
      spaceTeamEntries.value = [];
    } else {
      if (isLoadingMoreTeamEntries.value || !hasMoreTeamEntries.value) return;
      isLoadingMoreTeamEntries.value = true;
    }

    entriesError.value = null;

    try {
      const from = isInitial ? 0 : spaceTeamEntries.value.length;
      const to = from + TEAM_PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects (*), tasks (*), profiles (*)')
        .eq('space_id', targetSpaceId)
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      const fetched = (data as TimeEntry[]) || [];

      if (isInitial) {
        spaceTeamEntries.value = fetched;
      } else {
        spaceTeamEntries.value = [...spaceTeamEntries.value, ...fetched];
      }

      hasMoreTeamEntries.value = fetched.length === TEAM_PAGE_SIZE;
    } catch (err: any) {
      entriesError.value = err.message || 'Failed to fetch space entries';
    } finally {
      isLoadingEntries.value = false;
      isLoadingMoreTeamEntries.value = false;
    }
  }

  async function addManualEntry(payload: {
    projectId: string;
    taskId?: string | null;
    startedAt: string;
    endedAt: string;
    notes?: string;
    status?: EntryStatus;
  }): Promise<boolean> {
    if (!user.value || !currentSpace.value) {
      entriesError.value = 'Space selection required';
      return false;
    }

    if (!payload.projectId) {
      entriesError.value = 'Project is required for time entries';
      return false;
    }

    const startMs = new Date(payload.startedAt).getTime();
    const endMs = new Date(payload.endedAt).getTime();
    if (endMs < startMs) {
      entriesError.value = 'End time cannot be before start time';
      return false;
    }

    isLoadingEntries.value = true;
    entriesError.value = null;

    try {
      const { data, error } = await supabase.from('time_entries').insert({
        space_id: currentSpace.value.id,
        user_id: user.value.id,
        project_id: payload.projectId,
        task_id: payload.taskId || null,
        started_at: payload.startedAt,
        ended_at: payload.endedAt,
        notes: payload.notes?.trim() || null,
        status: payload.status || 'awaiting',
      }).select('*, projects (*), tasks (*)').single();

      if (error) throw error;

      if (data) {
        userEntries.value = [data as TimeEntry, ...userEntries.value];
        spaceTeamEntries.value = [data as TimeEntry, ...spaceTeamEntries.value];
      }
      return true;
    } catch (err: any) {
      entriesError.value = err.message || 'Failed to add manual entry';
      return false;
    } finally {
      isLoadingEntries.value = false;
    }
  }

  async function updateEntry(
    id: string,
    updates: {
      projectId?: string | null;
      taskId?: string | null;
      startedAt?: string;
      endedAt?: string;
      notes?: string;
      status?: EntryStatus;
    }
  ): Promise<boolean> {
    const existing = userEntries.value.find((e) => e.id === id)
      ?? spaceTeamEntries.value.find((e) => e.id === id);
    if (!isOwner.value && existing && existing.status !== 'awaiting') {
      entriesError.value = 'This entry is locked and cannot be edited.';
      return false;
    }
    if (updates.startedAt && updates.endedAt) {
      if (new Date(updates.endedAt).getTime() < new Date(updates.startedAt).getTime()) {
        entriesError.value = 'End time cannot be before start time';
        return false;
      }
    }

    entriesError.value = null;

    try {
      const payload: any = {
        updated_at: new Date().toISOString(),
      };
      if (updates.projectId !== undefined) payload.project_id = updates.projectId || null;
      if (updates.taskId !== undefined) payload.task_id = updates.taskId || null;
      if (updates.startedAt) payload.started_at = updates.startedAt;
      if (updates.endedAt) payload.ended_at = updates.endedAt;
      if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;
      if (updates.status !== undefined) payload.status = updates.status;

      const { data, error } = await supabase.from('time_entries').update(payload).eq('id', id)
        .select('*, projects (*), tasks (*), profiles (*)').single();

      if (error) throw error;

      if (data) {
        const idx = userEntries.value.findIndex((e) => e.id === id);
        if (idx !== -1) userEntries.value.splice(idx, 1, data as TimeEntry);
        const sidx = spaceTeamEntries.value.findIndex((e) => e.id === id);
        if (sidx !== -1) spaceTeamEntries.value.splice(sidx, 1, data as TimeEntry);
      }
      return true;
    } catch (err: any) {
      entriesError.value = err.message || 'Failed to update entry';
      return false;
    }
  }

  async function patchEntryStatus(id: string, status: EntryStatus): Promise<void> {
    const userIdx = userEntries.value.findIndex((e) => e.id === id);
    const spaceIdx = spaceTeamEntries.value.findIndex((e) => e.id === id);
    const prevStatus = userIdx !== -1
      ? userEntries.value[userIdx].status
      : spaceIdx !== -1 ? spaceTeamEntries.value[spaceIdx].status : undefined;

    if (userIdx !== -1) userEntries.value[userIdx] = { ...userEntries.value[userIdx], status };
    if (spaceIdx !== -1) spaceTeamEntries.value[spaceIdx] = { ...spaceTeamEntries.value[spaceIdx], status };

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch {
      if (userIdx !== -1) userEntries.value[userIdx] = { ...userEntries.value[userIdx], status: prevStatus };
      if (spaceIdx !== -1) spaceTeamEntries.value[spaceIdx] = { ...spaceTeamEntries.value[spaceIdx], status: prevStatus };
    }
  }

  async function bulkUpdateStatus(ids: string[], status: EntryStatus): Promise<boolean> {
    if (ids.length === 0) return true;
    const targetSpaceId = currentSpace.value?.id;
    if (!targetSpaceId) return false;

    const prevMap = new Map<string, EntryStatus | undefined>();
    ids.forEach((id) => {
      const found = spaceTeamEntries.value.find((e) => e.id === id);
      if (found) prevMap.set(id, found.status);
    });

    spaceTeamEntries.value = spaceTeamEntries.value.map((e) => {
      if (ids.includes(e.id)) {
        return { ...e, status };
      }
      return e;
    });

    userEntries.value = userEntries.value.map((e) => {
      if (ids.includes(e.id)) {
        return { ...e, status };
      }
      return e;
    });

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', ids);

      if (error) throw error;
      return true;
    } catch (err: any) {
      spaceTeamEntries.value = spaceTeamEntries.value.map((e) => {
        if (prevMap.has(e.id)) {
          return { ...e, status: prevMap.get(e.id) };
        }
        return e;
      });
      userEntries.value = userEntries.value.map((e) => {
        if (prevMap.has(e.id)) {
          return { ...e, status: prevMap.get(e.id) };
        }
        return e;
      });
      entriesError.value = err.message || 'Failed to bulk update status';
      return false;
    }
  }

  async function fetchAllSpaceTeamEntries(spaceId?: string): Promise<void> {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!targetSpaceId) return;

    if (spaceTeamEntries.value.length === 0) {
      await fetchSpaceTeamEntries(targetSpaceId, true);
    }

    while (hasMoreTeamEntries.value && !isLoadingMoreTeamEntries.value) {
      await fetchSpaceTeamEntries(targetSpaceId, false);
    }
  }

  async function fetchActiveTimers(spaceId?: string): Promise<void> {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!targetSpaceId) {
      activeTimers.value = [];
      return;
    }

    isLoadingActiveTimers.value = true;
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects (*), tasks (*), profiles (*)')
        .eq('space_id', targetSpaceId)
        .is('ended_at', null)
        .order('started_at', { ascending: false });

      if (error) throw error;
      activeTimers.value = (data as TimeEntry[]) || [];
    } catch (err: any) {
      console.error('Failed to fetch active timers:', err);
    } finally {
      isLoadingActiveTimers.value = false;
    }
  }

  async function deleteEntry(id: string): Promise<boolean> {
    const existing = userEntries.value.find((e) => e.id === id)
      ?? spaceTeamEntries.value.find((e) => e.id === id);
    if (!isOwner.value && existing && existing.status !== 'awaiting') {
      entriesError.value = 'This entry is locked and cannot be deleted.';
      return false;
    }
    isLoadingEntries.value = true;
    entriesError.value = null;

    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', id);

      if (error) throw error;

      userEntries.value = userEntries.value.filter((e) => e.id !== id);
      spaceTeamEntries.value = spaceTeamEntries.value.filter((e) => e.id !== id);
      return true;
    } catch (err: any) {
      entriesError.value = err.message || 'Failed to delete entry';
      return false;
    } finally {
      isLoadingEntries.value = false;
    }
  }

  return {
    userEntries,
    spaceTeamEntries,
    activeTimers,
    todayEntries,
    isLoadingEntries,
    isLoadingActiveTimers,
    isLoadingMoreUserEntries,
    hasMoreUserEntries,
    isLoadingMoreTeamEntries,
    hasMoreTeamEntries,
    entriesError,
    fetchUserEntries,
    fetchSpaceTeamEntries,
    fetchAllSpaceTeamEntries,
    fetchActiveTimers,
    addManualEntry,
    updateEntry,
    patchEntryStatus,
    bulkUpdateStatus,
    deleteEntry,
  };
}
