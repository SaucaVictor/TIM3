<script setup lang="ts">
interface Option {
  value: string | number;
  label: string;
}

interface Props {
  modelValue?: string | number | null;
  options: Option[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  placeholder: 'Select an option',
  disabled: false,
  required: false,
  error: null,
  id: () => 'select-' + Math.random().toString(36).substring(2, 9),
});

const emit = defineEmits(['update:modelValue', 'change']);

function handleChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
  emit('change', target.value);
}
</script>

<template>
  <div class="w-full flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-xs font-medium text-[#888888]">
      {{ label }}
      <span v-if="required" class="text-red-400">*</span>
    </label>
    <div class="relative w-full">
      <select
        :id="id"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        @change="handleChange"
        class="w-full appearance-none px-3.5 py-2.5 text-sm bg-[#181a1e] text-white border border-[#262930] rounded-xl transition-colors focus:outline-none focus:border-[#5bb8f5] focus:ring-1 focus:ring-[#5bb8f5] disabled:bg-[#0c0d10] disabled:text-[#888888] disabled:cursor-not-allowed pr-8 cursor-pointer"
        :class="error ? 'border-red-500 focus:border-red-500' : 'border-[#262930]'"
      >
        <option value="" disabled selected hidden v-if="placeholder">
          {{ placeholder }}
        </option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value" class="bg-[#181a1e] text-white">
          {{ opt.label }}
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#888888]">
        <svg class="h-4 w-4 fill-current" viewBox="0 0 20 20">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </div>
    </div>
    <span v-if="error" class="text-xs text-red-400 font-mono">{{ error }}</span>
  </div>
</template>
