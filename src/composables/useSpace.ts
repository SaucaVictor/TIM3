import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { generateJoinCode } from '@/lib/utils';
import type { Space, SpaceMember, Role } from '@/types';

const userSpaces = ref<Space[]>([]);
const currentSpace = ref<Space | null>(null);
const currentRole = ref<Role>('member');
const spaceMembers = ref<SpaceMember[]>([]);
const isLoadingSpaces = ref<boolean>(false);
const spaceError = ref<string | null>(null);

export function useSpace() {
  const { user } = useAuth();

  const isOwner = computed(() => currentRole.value === 'owner' || currentRole.value === 'co-owner');
  const isPrimaryOwner = computed(() => currentRole.value === 'owner');

  async function fetchUserSpaces() {
    if (!user.value) {
      userSpaces.value = [];
      currentSpace.value = null;
      return;
    }

    isLoadingSpaces.value = true;
    spaceError.value = null;

    try {
      // Get space memberships for current user sorted by joined_at desc
      const { data: memberRows, error: memberErr } = await supabase
        .from('space_members')
        .select('space_id, role, joined_at, spaces (*)')
        .eq('user_id', user.value.id)
        .order('joined_at', { ascending: false });

      if (memberErr) throw memberErr;

      const loadedSpaces: Space[] = [];

      if (memberRows && memberRows.length > 0) {
        memberRows.forEach((row: any) => {
          if (row.spaces) {
            loadedSpaces.push(row.spaces as Space);
          }
        });
      }

      userSpaces.value = loadedSpaces;

      // Restore previously selected space or default to first
      const savedSpaceId = localStorage.getItem('tim3_active_space_id');
      const targetSpace = loadedSpaces.find((s) => s.id === savedSpaceId) || loadedSpaces[0] || null;

      if (targetSpace) {
        await selectSpace(targetSpace);
      } else {
        currentSpace.value = null;
      }
    } catch (err: any) {
      spaceError.value = err.message || 'Failed to fetch spaces';
    } finally {
      isLoadingSpaces.value = false;
    }
  }

  async function selectSpace(space: Space) {
    currentSpace.value = space;
    localStorage.setItem('tim3_active_space_id', space.id);

    // Fetch user's role in this space
    if (user.value) {
      const { data, error } = await supabase
        .from('space_members')
        .select('role')
        .eq('space_id', space.id)
        .eq('user_id', user.value.id)
        .single();

      if (!error && data) {
        currentRole.value = data.role as Role;
      } else {
        currentRole.value = space.owner_id === user.value.id ? 'owner' : 'member';
      }
    }

    await fetchSpaceMembers(space.id);
  }

  async function fetchSpaceMembers(spaceId?: string) {
    const targetId = spaceId || currentSpace.value?.id;
    if (!targetId) return;

    try {
      const { data, error } = await supabase
        .from('space_members')
        .select('*, profiles (*)')
        .eq('space_id', targetId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      spaceMembers.value = (data as SpaceMember[]) || [];
    } catch (err: any) {
      console.error('Error fetching space members:', err);
    }
  }

  async function updateMemberRole(memberId: string, newRole: Role): Promise<boolean> {
    if (!user.value || !isOwner.value) return false;
    try {
      const { error } = await supabase
        .from('space_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      await fetchSpaceMembers();
      return true;
    } catch (err: any) {
      console.error('Error updating member role:', err);
      return false;
    }
  }

  async function removeMember(memberId: string): Promise<boolean> {
    if (!user.value || !isOwner.value) return false;
    try {
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      await fetchSpaceMembers();
      return true;
    } catch (err: any) {
      console.error('Error removing member:', err);
      return false;
    }
  }

  async function createSpace(name: string): Promise<Space | null> {
    if (!user.value) {
      spaceError.value = 'Must be signed in to create a space';
      return null;
    }

    isLoadingSpaces.value = true;
    spaceError.value = null;

    try {
      const code = generateJoinCode();

      // Try RPC function first
      const { data: rpcSpaceId, error: rpcErr } = await supabase.rpc('create_space_with_owner', {
        space_name: name.trim(),
        code: code,
      });

      let createdSpace: Space | null = null;

      if (!rpcErr && rpcSpaceId) {
        const { data: fetchSpace } = await supabase
          .from('spaces')
          .select('*')
          .eq('id', rpcSpaceId)
          .single();
        createdSpace = fetchSpace as Space;
      } else {
        // Direct table fallback if RPC trigger isn't executed
        const { data: newSpace, error: spaceInsertErr } = await supabase
          .from('spaces')
          .insert({
            name: name.trim(),
            join_code: code,
            owner_id: user.value.id,
          })
          .select('*')
          .single();

        if (spaceInsertErr) throw spaceInsertErr;
        createdSpace = newSpace as Space;

        // Insert space member as owner
        const { error: memberInsertErr } = await supabase.from('space_members').insert({
          space_id: createdSpace.id,
          user_id: user.value.id,
          role: 'owner',
        });

        if (memberInsertErr) console.warn('Member insert warn:', memberInsertErr);
      }

      await fetchUserSpaces();
      if (createdSpace) {
        await selectSpace(createdSpace);
      }
      return createdSpace;
    } catch (err: any) {
      spaceError.value = err.message || 'Failed to create space';
      return null;
    } finally {
      isLoadingSpaces.value = false;
    }
  }

  async function joinSpace(code: string): Promise<Space | null> {
    if (!user.value) {
      spaceError.value = 'Must be signed in to join a space';
      return null;
    }

    const cleanCode = code.trim().toUpperCase();
    isLoadingSpaces.value = true;
    spaceError.value = null;

    try {
      // Try RPC function
      const { data: rpcSpaceId, error: rpcErr } = await supabase.rpc('join_space_by_code', {
        code: cleanCode,
      });

      let targetSpaceId = rpcSpaceId;

      if (rpcErr || !rpcSpaceId) {
        // Direct query fallback
        const { data: spaceRow, error: findErr } = await supabase
          .from('spaces')
          .select('id')
          .eq('join_code', cleanCode)
          .single();

        if (findErr || !spaceRow) {
          throw new Error('Invalid or non-existent join code');
        }

        targetSpaceId = spaceRow.id;

        // Insert member if not already present
        await supabase.from('space_members').insert({
          space_id: targetSpaceId,
          user_id: user.value.id,
          role: 'member',
        });
      }

      await fetchUserSpaces();
      const joinedSpace = userSpaces.value.find((s) => s.id === targetSpaceId) || null;
      if (joinedSpace) {
        await selectSpace(joinedSpace);
      }
      return joinedSpace;
    } catch (err: any) {
      spaceError.value = err.message || 'Invalid join code or failed to join space';
      return null;
    } finally {
      isLoadingSpaces.value = false;
    }
  }

  async function deleteSpace(spaceId: string): Promise<boolean> {
    if (!user.value) {
      spaceError.value = 'Must be signed in to delete a space';
      return false;
    }

    if (!isPrimaryOwner.value) {
      spaceError.value = 'Only the primary space owner can delete this space';
      return false;
    }

    isLoadingSpaces.value = true;
    spaceError.value = null;

    try {
      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', spaceId);

      if (error) throw error;

      await fetchUserSpaces();
      return true;
    } catch (err: any) {
      spaceError.value = err.message || 'Failed to delete space';
      return false;
    } finally {
      isLoadingSpaces.value = false;
    }
  }

  return {
    userSpaces,
    currentSpace,
    currentRole,
    spaceMembers,
    isLoadingSpaces,
    spaceError,
    isOwner,
    isPrimaryOwner,
    fetchUserSpaces,
    selectSpace,
    createSpace,
    joinSpace,
    deleteSpace,
    fetchSpaceMembers,
    updateMemberRole,
    removeMember,
  };
}
