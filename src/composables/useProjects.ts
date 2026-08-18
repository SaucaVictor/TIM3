import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpace } from './useSpace';
import type { Project, Task, ProjectBillingRule } from '@/types';

const projects = ref<Project[]>([]);
const isLoadingProjects = ref<boolean>(false);
const projectError = ref<string | null>(null);

export function useProjects() {
  const { currentSpace, isOwner } = useSpace();

  async function fetchProjects(spaceId?: string) {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!targetSpaceId) {
      projects.value = [];
      return;
    }

    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, tasks (*), responsible_profile:profiles!projects_responsible_user_id_fkey (*)')
        .eq('space_id', targetSpaceId);

      if (error) {
        // Fallback simple query if FK alias differs
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('projects')
          .select('*, tasks (*)')
          .eq('space_id', targetSpaceId);

        if (fallbackErr) throw fallbackErr;
        projects.value = (fallbackData as Project[]) || [];
      } else {
        projects.value = (data as Project[]) || [];
      }
    } catch (err: any) {
      projectError.value = err.message || 'Failed to fetch projects';
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function createProject(name: string, responsibleUserId?: string | null): Promise<Project | null> {
    if (!currentSpace.value) return null;

    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          space_id: currentSpace.value.id,
          name: name.trim(),
          responsible_user_id: responsibleUserId || null,
        })
        .select('*')
        .single();

      if (error) throw error;
      await fetchProjects();
      return data as Project;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to create project';
      return null;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function updateProjectResponsible(id: string, responsibleUserId: string | null): Promise<boolean> {
    if (!isOwner.value) return false;
    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ responsible_user_id: responsibleUserId })
        .eq('id', id);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to update responsible person';
      return false;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function renameProject(id: string, name: string): Promise<boolean> {
    if (!isOwner.value) return false;
    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: name.trim() })
        .eq('id', id);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to rename project';
      return false;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function updateProjectBillingRules(id: string, rules: ProjectBillingRule[]): Promise<boolean> {
    if (!isOwner.value) return false;
    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ billing_rules: rules })
        .eq('id', id);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to update billing rules';
      return false;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function deleteProject(id: string): Promise<boolean> {
    if (!isOwner.value) return false;
    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to delete project. Make sure dependent entries are cleared.';
      return false;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function createTask(projectId: string, name: string): Promise<Task | null> {
    if (!currentSpace.value) return null;

    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          space_id: currentSpace.value.id,
          name: name.trim(),
        })
        .select('*')
        .single();

      if (error) throw error;
      await fetchProjects();
      return data as Task;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to create task';
      return null;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function renameTask(taskId: string, name: string): Promise<boolean> {
    if (!isOwner.value) return false;
    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ name: name.trim() })
        .eq('id', taskId);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to rename task';
      return false;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    if (!isOwner.value) return false;
    isLoadingProjects.value = true;
    projectError.value = null;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);

      if (error) throw error;
      await fetchProjects();
      return true;
    } catch (err: any) {
      projectError.value = err.message || 'Failed to delete task';
      return false;
    } finally {
      isLoadingProjects.value = false;
    }
  }

  return {
    projects,
    isLoadingProjects,
    projectError,
    fetchProjects,
    createProject,
    updateProjectResponsible,
    updateProjectBillingRules,
    renameProject,
    deleteProject,
    createTask,
    renameTask,
    deleteTask,
  };
}
