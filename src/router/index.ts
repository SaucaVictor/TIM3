import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useSpace } from '@/composables/useSpace';

import LoginView from '@/views/LoginView.vue';
import SpaceSelectView from '@/views/SpaceSelectView.vue';
import TimerView from '@/views/TimerView.vue';
import DashboardView from '@/views/DashboardView.vue';
import ProjectsView from '@/views/ProjectsView.vue';
import MembersView from '@/views/MembersView.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true, class: 'flex' },
  },
  {
    path: '/spaces',
    name: 'spaces',
    component: SpaceSelectView,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    name: 'timer',
    component: TimerView,
    meta: { requiresAuth: true, requiresSpace: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: DashboardView,
    meta: { requiresAuth: true, requiresSpace: true, requiresOwner: true },
  },
  {
    path: '/projects',
    name: 'projects',
    component: ProjectsView,
    meta: { requiresAuth: true, requiresSpace: true, requiresOwner: true },
  },
  {
    path: '/members',
    name: 'members',
    component: MembersView,
    meta: { requiresAuth: true, requiresSpace: true, requiresOwner: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    // Only scroll to top if navigating to a different page route path
    if (to.path === from.path) {
      return;
    }
    return { top: 0, left: 0 };
  },
});

router.beforeEach(async (to, _from) => {
  const { isAuthenticated, initAuth } = useAuth();
  const { currentSpace, fetchUserSpaces, isOwner } = useSpace();

  await initAuth();

  // Public routes (Login)
  if (to.meta.public) {
    if (isAuthenticated.value) {
      await fetchUserSpaces();
      return currentSpace.value ? '/' : '/spaces';
    }
    return; // allow
  }

  // Auth check
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return '/login';
  }

  // Ensure spaces are loaded
  if (isAuthenticated.value && (!currentSpace.value || useSpace().userSpaces.value.length === 0)) {
    await fetchUserSpaces();
  }

  // Space requirement check
  if (to.meta.requiresSpace && !currentSpace.value) {
    return '/spaces';
  }

  // Owner requirement check
  if (to.meta.requiresOwner && !isOwner.value) {
    return '/';
  }

  // Allow navigation
});

export default router;
