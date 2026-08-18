<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';

const { signInWithGoogle, isLoading, authError } = useAuth();

async function handleGoogleLogin() {
  await signInWithGoogle();
}
</script>

<template>
  <div class="fixed inset-0 z-20 bg-[#07080b] text-white flex flex-col justify-center items-center px-4 overflow-hidden font-sans selection:bg-[#5bb8f5]">
    <!-- Pulsating & Breathing Mesh Background Blobs -->
    <div class="absolute -top-36 -left-36 w-[34rem] h-[34rem] bg-[#5bb8f5]/40 rounded-full blur-[120px] animate-pulse-1 pointer-events-none"></div>
    <div class="absolute -bottom-36 -right-36 w-[38rem] h-[38rem] bg-indigo-600/40 rounded-full blur-[130px] animate-pulse-2 pointer-events-none"></div>
    <div class="absolute top-1/3 right-1/4 w-96 h-96 bg-teal-400/35 rounded-full blur-[110px] animate-pulse-3 pointer-events-none"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-400/25 rounded-full blur-[90px] animate-pulse-center pointer-events-none"></div>

    <div class="w-full max-w-sm space-y-4 text-center relative z-10">
      <!-- Title Branding with white TIM and left-to-right blue-to-reddish gradient 3 -->
      <h1 class="text-3xl font-extrabold tracking-tight select-none">
        <span class="text-white">TIM</span><span class="text-transparent bg-clip-text bg-gradient-to-r from-[#5bb8f5] to-[#f43f5e]">3</span>
      </h1>

      <div v-if="authError" class="p-3 bg-red-950/80 border border-red-800 text-xs font-mono text-red-300 rounded-xl text-left">
        {{ authError }}
      </div>

      <!-- Glassmorphic Login Card -->
      <div class="bg-[#121319]/50 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <!-- Accent Glow Top Line -->
        <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#5bb8f5]/70 to-transparent"></div>

        <button
          @click="handleGoogleLogin"
          :disabled="isLoading"
          class="w-full h-12 px-4 bg-white hover:bg-slate-100 text-neutral-900 font-bold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer active:scale-95 disabled:opacity-50 shadow-xl shadow-black/30 group"
        >
          <svg class="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span class="font-bold text-neutral-900">Continue with Google</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulseBreathe1 {
  0%, 100% {
    transform: translate(0px, 0px) scale(0.9);
    opacity: 0.25;
  }
  50% {
    transform: translate(50px, -40px) scale(1.45);
    opacity: 0.65;
  }
}

@keyframes pulseBreathe2 {
  0%, 100% {
    transform: translate(0px, 0px) scale(1.35);
    opacity: 0.55;
  }
  50% {
    transform: translate(-40px, 50px) scale(0.85);
    opacity: 0.2;
  }
}

@keyframes pulseBreathe3 {
  0%, 100% {
    transform: translate(0px, 0px) scale(0.85);
    opacity: 0.2;
  }
  50% {
    transform: translate(-60px, -30px) scale(1.5);
    opacity: 0.6;
  }
}

@keyframes pulseBreatheCenter {
  0%, 100% {
    transform: translate(-50%, -50%) scale(0.85);
    opacity: 0.15;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0.5;
  }
}

.animate-pulse-1 {
  animation: pulseBreathe1 7s ease-in-out infinite;
}

.animate-pulse-2 {
  animation: pulseBreathe2 9s ease-in-out infinite;
}

.animate-pulse-3 {
  animation: pulseBreathe3 8s ease-in-out infinite;
}

.animate-pulse-center {
  animation: pulseBreatheCenter 6s ease-in-out infinite;
}
</style>
