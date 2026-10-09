import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpace } from './useSpace';
import { calculateAge } from '@/lib/billing';
import type { SpaceTeam, SpaceMember } from '@/types';

const teams = ref<SpaceTeam[]>([]);
const isLoadingTeams = ref<boolean>(false);
const teamsError = ref<string | null>(null);

function getLocalTeamsKey(spaceId: string) {
  return `tim3_teams_${spaceId}`;
}

function loadFromLocalStorage(spaceId: string): SpaceTeam[] {
  try {
    const raw = localStorage.getItem(getLocalTeamsKey(spaceId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading teams from localStorage:', e);
  }
  return [];
}

function saveToLocalStorage(spaceId: string, data: SpaceTeam[]) {
  try {
    localStorage.setItem(getLocalTeamsKey(spaceId), JSON.stringify(data));
  } catch (e) {
    console.error('Error saving teams to localStorage:', e);
  }
}

function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function sanitizeTeam(team: any): SpaceTeam {
  const id = isValidUUID(team.id) ? team.id : generateUUID();
  let memberIds: string[] = [];
  if (Array.isArray(team.member_ids)) {
    memberIds = team.member_ids;
  } else if (typeof team.member_ids === 'string') {
    try {
      memberIds = JSON.parse(team.member_ids);
    } catch {
      memberIds = [];
    }
  }
  return {
    ...team,
    id,
    member_ids: (Array.isArray(memberIds) ? memberIds : []).filter((m) => isValidUUID(m)),
  };
}

export function useTeams() {
  const { currentSpace } = useSpace();

  async function fetchTeams(spaceId?: string) {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!targetSpaceId) {
      teams.value = [];
      return;
    }

    // Immediately load and sanitize from localStorage so there's zero delay/flash
    const local = loadFromLocalStorage(targetSpaceId).map(sanitizeTeam);
    if (local.length > 0) {
      teams.value = local;
      saveToLocalStorage(targetSpaceId, local);
    }

    isLoadingTeams.value = true;
    teamsError.value = null;

    try {
      const { data, error } = await supabase
        .from('space_teams')
        .select('*')
        .eq('space_id', targetSpaceId)
        .order('name', { ascending: true });

      if (error) {
        console.warn('Supabase space_teams fetch error (falling back to localStorage):', error);
        teams.value = loadFromLocalStorage(targetSpaceId).map(sanitizeTeam);
      } else if (data && data.length > 0) {
        const fetched: SpaceTeam[] = data.map(sanitizeTeam);
        teams.value = fetched;
        saveToLocalStorage(targetSpaceId, fetched);
      } else {
        // data is empty array from Supabase
        const existingLocal = loadFromLocalStorage(targetSpaceId).map(sanitizeTeam);
        if (existingLocal.length > 0) {
          teams.value = existingLocal;
          saveToLocalStorage(targetSpaceId, existingLocal);

          // Sync existing local teams up to Supabase with valid UUIDs
          for (const localTeam of existingLocal) {
            try {
              await supabase.from('space_teams').insert({
                id: localTeam.id,
                space_id: localTeam.space_id,
                name: localTeam.name,
                min_age: localTeam.min_age,
                max_age: localTeam.max_age,
                member_ids: localTeam.member_ids,
              });
            } catch (syncErr) {
              // Ignore
            }
          }
        } else {
          teams.value = [];
          saveToLocalStorage(targetSpaceId, []);
        }
      }
    } catch (err: any) {
      teams.value = loadFromLocalStorage(targetSpaceId).map(sanitizeTeam);
    } finally {
      isLoadingTeams.value = false;
    }
  }

  function getMembersForAgeRule(
    members: SpaceMember[],
    minAge?: number | null,
    maxAge?: number | null
  ): string[] {
    if (minAge == null && maxAge == null) return [];

    const matchedIds: string[] = [];
    for (const member of members) {
      const age = calculateAge(member.profiles?.dob);
      if (age == null) continue;

      let matches = true;
      if (minAge != null && age < minAge) matches = false;
      if (maxAge != null && age > maxAge) matches = false;

      if (matches && isValidUUID(member.user_id)) {
        matchedIds.push(member.user_id);
      }
    }
    return matchedIds;
  }

  async function createTeam(payload: {
    name: string;
    min_age?: number | null;
    max_age?: number | null;
    member_ids?: string[];
  }): Promise<SpaceTeam | null> {
    const targetSpaceId = currentSpace.value?.id;
    if (!targetSpaceId) return null;

    const validMemberIds = (payload.member_ids || []).filter((id) => isValidUUID(id));
    const newTeam: SpaceTeam = {
      id: generateUUID(),
      space_id: targetSpaceId,
      name: payload.name.trim(),
      min_age: payload.min_age ?? null,
      max_age: payload.max_age ?? null,
      member_ids: validMemberIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    teams.value = [...teams.value, newTeam];
    saveToLocalStorage(targetSpaceId, teams.value);

    try {
      const { data, error } = await supabase
        .from('space_teams')
        .insert([{
          id: newTeam.id,
          space_id: newTeam.space_id,
          name: newTeam.name,
          min_age: newTeam.min_age,
          max_age: newTeam.max_age,
          member_ids: newTeam.member_ids,
        }])
        .select()
        .single();

      if (!error && data) {
        newTeam.id = data.id;
      }
    } catch (err) {
      // Local copy is already saved
    }

    return newTeam;
  }

  async function updateTeam(
    teamId: string,
    updates: Partial<Omit<SpaceTeam, 'id' | 'space_id' | 'created_at'>>
  ): Promise<boolean> {
    const targetSpaceId = currentSpace.value?.id;
    if (!targetSpaceId) return false;

    const existingIndex = teams.value.findIndex((t) => t.id === teamId);
    if (existingIndex === -1) return false;

    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.member_ids) {
      sanitizedUpdates.member_ids = sanitizedUpdates.member_ids.filter((id) => isValidUUID(id));
    }

    const updated: SpaceTeam = {
      ...teams.value[existingIndex],
      ...sanitizedUpdates,
      updated_at: new Date().toISOString(),
    };

    teams.value[existingIndex] = updated;
    saveToLocalStorage(targetSpaceId, teams.value);

    if (isValidUUID(teamId)) {
      try {
        await supabase
          .from('space_teams')
          .update({
            name: updated.name,
            min_age: updated.min_age,
            max_age: updated.max_age,
            member_ids: updated.member_ids,
            updated_at: updated.updated_at,
          })
          .eq('id', teamId);
      } catch (err) {
        // Local copy is already updated
      }
    }

    return true;
  }

  async function deleteTeam(teamId: string): Promise<boolean> {
    const targetSpaceId = currentSpace.value?.id;
    if (!targetSpaceId) return false;

    teams.value = teams.value.filter((t) => t.id !== teamId);
    saveToLocalStorage(targetSpaceId, teams.value);

    try {
      await supabase.from('space_teams').delete().eq('id', teamId);
    } catch (err) {
      // Local copy is already updated
    }

    return true;
  }

  async function syncTeamMembers(teamId: string, members: SpaceMember[]): Promise<number> {
    const team = teams.value.find((t) => t.id === teamId);
    if (!team) return 0;

    const qualifyingIds = getMembersForAgeRule(members, team.min_age, team.max_age);
    // Combine existing members with qualifying members (no duplicates)
    const combinedSet = new Set([...team.member_ids, ...qualifyingIds]);
    const updatedMemberIds = Array.from(combinedSet);
    const addedCount = updatedMemberIds.length - team.member_ids.length;

    await updateTeam(teamId, { member_ids: updatedMemberIds });
    return addedCount;
  }

  return {
    teams,
    isLoadingTeams,
    teamsError,
    fetchTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    getMembersForAgeRule,
    syncTeamMembers,
  };
}
