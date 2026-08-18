import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import type { User, Session } from '@supabase/supabase-js';

const user = ref<User | null>(null);
const session = ref<Session | null>(null);
const profile = ref<Profile | null>(null);
const isLoading = ref<boolean>(true);
const authError = ref<string | null>(null);
const isInitialized = ref<boolean>(false);
const isSigningOut = ref(false);

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(user.value));

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else if (data) {
        profile.value = data as Profile;
      }
    } catch (err: any) {
      console.error('Error in fetchProfile:', err);
    }
  }

  function cleanAuthHash() {
    if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('error='))) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  async function initAuth() {
    if (isInitialized.value) return;
    isLoading.value = true;
    authError.value = null;

    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        authError.value = error.message;
      } else if (currentSession) {
        session.value = currentSession;
        user.value = currentSession.user;
        await fetchProfile(currentSession.user.id);
      }

      cleanAuthHash();

      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        session.value = newSession;
        user.value = newSession?.user || null;
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          profile.value = null;
        }
        cleanAuthHash();
      });
    } catch (err: any) {
      authError.value = err.message || 'Authentication initialization failed';
    } finally {
      isLoading.value = false;
      isInitialized.value = true;
    }
  }

  async function signInWithGoogle() {
    authError.value = null;
    try {
      const redirectUrl = window.location.origin + '/';
      console.log('[TIM3 Auth] Signing in with Google, redirectTo:', redirectUrl);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      authError.value = err.message || 'Failed to sign in with Google';
    }
  }

  async function updateProfile(updates: { full_name?: string; dob?: string | null }): Promise<boolean> {
    if (!user.value) return false;
    authError.value = null;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.value.id);
      if (error) throw error;
      if (profile.value) {
        profile.value = { ...profile.value, ...updates };
      }
      return true;
    } catch (err: any) {
      authError.value = err.message || 'Failed to update profile';
      return false;
    }
  }

  async function signOut() {
    authError.value = null;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      user.value = null;
      session.value = null;
      profile.value = null;
      isSigningOut.value = false;
    } catch (err: any) {
      authError.value = err.message || 'Failed to sign out';
    }
  }

  // Helper mock login for testing without live Supabase OAuth credentials if needed
  async function signInWithDevDemo(email = 'victor@example.com', name = 'Victor') {
    authError.value = null;
    const fakeId = 'dev-user-' + btoa(email).substring(0, 8);
    const mockUser = {
      id: fakeId,
      email,
      user_metadata: { full_name: name },
    } as unknown as User;

    user.value = mockUser;
    profile.value = {
      id: fakeId,
      email,
      full_name: name,
      avatar_url: null,
      created_at: new Date().toISOString(),
    };
  }

  return {
    user,
    session,
    profile,
    isLoading,
    authError,
    isAuthenticated,
    isSigningOut,
    initAuth,
    signInWithGoogle,
    signInWithDevDemo,
    signOut,
    updateProfile,
  };
}
