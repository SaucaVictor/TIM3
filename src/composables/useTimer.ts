import { ref, computed, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useSpace } from './useSpace';
import { useTimeEntries } from './useTimeEntries';
import { formatElapsedMs } from '@/lib/utils';
import type { TimeEntry } from '@/types';

const activeTimerEntry = ref<TimeEntry | null>(null);
const elapsedMs = ref<number>(0);
const isTimerLoading = ref<boolean>(false);
const timerError = ref<string | null>(null);

let tickInterval: number | null = null;
let isListenerAttached = false;

export function useTimer() {
  const { user } = useAuth();
  const { currentSpace } = useSpace();

  const isTimerRunning = computed(() => Boolean(activeTimerEntry.value && !activeTimerEntry.value.ended_at));
  const formattedElapsed = computed(() => formatElapsedMs(elapsedMs.value));

  function updateBrowserMetadata() {
    if (typeof document === 'undefined') return;

    const defaultTitle = 'TIM3';

    if (isTimerRunning.value && activeTimerEntry.value) {
      const projName = activeTimerEntry.value.projects?.name;
      const taskName = activeTimerEntry.value.tasks?.name;
      const label = [projName, taskName].filter(Boolean).join(' - ');
      document.title = label ? `▶ ${formattedElapsed.value} — ${label}` : `▶ ${formattedElapsed.value} — TIM3`;

      // PWA Badging API for App icon badge on Dock/Taskbar/Homescreen
      if ('setAppBadge' in navigator) {
        (navigator as any).setAppBadge(1).catch(() => {});
      }

      // Media Session API for OS lockscreen & notification centers
      if ('mediaSession' in navigator && (window as any).MediaMetadata) {
        try {
          navigator.mediaSession.playbackState = 'playing';
          navigator.mediaSession.metadata = new (window as any).MediaMetadata({
            title: `TIM3: ${formattedElapsed.value}`,
            artist: projName || 'Active Timer',
            album: activeTimerEntry.value.notes || taskName || 'Time Tracking',
            artwork: [{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }],
          });
        } catch (_) {}
      }
    } else {
      document.title = defaultTitle;

      // Clear PWA badge
      if ('clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(() => {});
      }

      // Clear Media Session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    }
  }

  function updateElapsed() {
    if (activeTimerEntry.value && activeTimerEntry.value.started_at) {
      const startTime = new Date(activeTimerEntry.value.started_at).getTime();
      const now = Date.now();
      elapsedMs.value = Math.max(0, now - startTime);
    } else {
      elapsedMs.value = 0;
    }
    updateBrowserMetadata();
  }

  function startTicking() {
    stopTicking();
    updateElapsed();
    tickInterval = window.setInterval(() => {
      updateElapsed();
    }, 500);
  }

  function stopTicking() {
    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    updateBrowserMetadata();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && isTimerRunning.value) {
      updateElapsed();
    }
  }

  function setupVisibilityListener() {
    if (!isListenerAttached && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleVisibilityChange);
      isListenerAttached = true;
    }
  }

  async function checkActiveTimer(spaceId?: string) {
    const targetSpaceId = spaceId || currentSpace.value?.id;
    if (!user.value || !targetSpaceId) {
      activeTimerEntry.value = null;
      stopTicking();
      return;
    }

    isTimerLoading.value = true;
    timerError.value = null;

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects (*), tasks (*)')
        .eq('space_id', targetSpaceId)
        .eq('user_id', user.value.id)
        .is('ended_at', null)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        activeTimerEntry.value = data as TimeEntry;
        startTicking();
        setupVisibilityListener();
      } else {
        activeTimerEntry.value = null;
        stopTicking();
      }
    } catch (err: any) {
      console.error('Error checking active timer:', err);
      timerError.value = err.message || 'Failed to sync timer state';
    } finally {
      isTimerLoading.value = false;
    }
  }

  async function startTimer(projectId: string, taskId?: string | null, notes?: string): Promise<boolean> {
    if (!user.value || !currentSpace.value) {
      timerError.value = 'Must select a space to start a timer';
      return false;
    }

    if (!projectId) {
      timerError.value = 'Project is required to start a timer';
      return false;
    }

    if (isTimerRunning.value) {
      timerError.value = 'A timer is already active. Please stop it first.';
      return false;
    }

    isTimerLoading.value = true;
    timerError.value = null;

    const startedAt = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          space_id: currentSpace.value.id,
          user_id: user.value.id,
          project_id: projectId,
          task_id: taskId || null,
          started_at: startedAt,
          ended_at: null,
          notes: notes?.trim() || null,
        })
        .select('*, projects (*), tasks (*)')
        .single();

      if (error) {
        // Handle database constraint error (unique_active_timer_per_user_space)
        if (error.code === '23505' || error.message.includes('unique_active_timer')) {
          await checkActiveTimer(currentSpace.value.id);
          throw new Error('An active timer already exists for this space.');
        }
        throw error;
      }

      activeTimerEntry.value = data as TimeEntry;
      startTicking();
      setupVisibilityListener();
      return true;
    } catch (err: any) {
      timerError.value = err.message || 'Failed to start timer';
      return false;
    } finally {
      isTimerLoading.value = false;
    }
  }

  async function stopTimer(): Promise<boolean> {
    if (!activeTimerEntry.value) return false;

    isTimerLoading.value = true;
    timerError.value = null;

    const endedAt = new Date().toISOString();
    const entryToFinish = { ...activeTimerEntry.value, ended_at: endedAt };

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          ended_at: endedAt,
          updated_at: endedAt,
        })
        .eq('id', activeTimerEntry.value.id);

      if (error) throw error;

      activeTimerEntry.value = null;
      elapsedMs.value = 0;
      stopTicking();

      // Optimistically prepend the finished entry — no loading flash
      const { userEntries, spaceTeamEntries } = useTimeEntries();
      userEntries.value = [entryToFinish as any, ...userEntries.value];
      spaceTeamEntries.value = [entryToFinish as any, ...spaceTeamEntries.value];

      return true;
    } catch (err: any) {
      timerError.value = err.message || 'Failed to stop timer';
      return false;
    } finally {
      isTimerLoading.value = false;
    }
  }

  // Watch space changes to re-sync active timer
  watch(
    () => currentSpace.value?.id,
    (newSpaceId) => {
      if (newSpaceId) {
        checkActiveTimer(newSpaceId);
      }
    },
    { immediate: true }
  );

  return {
    activeTimerEntry,
    isTimerRunning,
    elapsedMs,
    formattedElapsed,
    isTimerLoading,
    timerError,
    checkActiveTimer,
    startTimer,
    stopTimer,
    updateElapsed,
  };
}
