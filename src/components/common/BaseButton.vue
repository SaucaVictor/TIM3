<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
});

const emit = defineEmits(['click']);

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#5bb8f5] disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl cursor-pointer';

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 h-8',
    md: 'px-4 py-2 text-sm gap-2 h-10 shadow-sm',
    lg: 'px-6 py-3 text-base gap-2.5 h-12 shadow-sm',
  };

  const variants = {
    primary: 'bg-[#5bb8f5] text-white hover:bg-[#7ac0e3] active:bg-[#4aa7e4]',
    cyan: 'bg-[#5bb8f5] text-white hover:bg-[#7ac0e3] active:bg-[#4aa7e4]',
    secondary: 'bg-[#252525] text-white hover:bg-[#2e2e2e] border border-[#262930]',
    outline: 'bg-transparent text-white border border-[#262930] hover:bg-[#252525]',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    ghost: 'bg-transparent text-[#888888] hover:bg-[#252525] hover:text-white',
  };

  return [base, sizes[props.size], variants[props.variant]];
});

function handleClick(e: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', e);
  }
}
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" @click="handleClick">
    <svg
      v-if="loading"
      class="animate-spin -ml-0.5 h-4 w-4 text-current"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <slot></slot>
  </button>
</template>
