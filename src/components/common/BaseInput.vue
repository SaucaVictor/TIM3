<script setup lang="ts">
interface Props {
  modelValue?: string | number;
  label?: string;
  type?: string;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  error: null,
  disabled: false,
  required: false,
  id: () => 'input-' + Math.random().toString(36).substring(2, 9),
});

const emit = defineEmits(['update:modelValue', 'blur', 'focus']);

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div class="w-full flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-xs font-medium text-[#888888]">
      {{ label }}
      <span v-if="required" class="text-red-400">*</span>
    </label>
    <input
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      @input="handleInput"
      @blur="$emit('blur', $event)"
      @focus="$emit('focus', $event)"
      class="w-full px-3.5 py-2.5 text-sm bg-[#181a1e] text-white border border-[#262930] rounded-xl transition-colors placeholder:text-[#888888]/60 focus:outline-none focus:border-[#5bb8f5] focus:ring-1 focus:ring-[#5bb8f5] disabled:bg-[#0c0d10] disabled:text-[#888888] disabled:cursor-not-allowed"
      :class="error ? 'border-red-500 focus:border-red-500' : 'border-[#262930]'"
    />
    <span v-if="error" class="text-xs text-red-400 font-mono">{{ error }}</span>
  </div>
</template>
