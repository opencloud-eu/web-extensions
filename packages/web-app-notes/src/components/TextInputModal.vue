<template>
  <div class="ext:p-6 ext:pt-2">
    <oc-text-input
      v-model="internalValue"
      :label="label"
      :placeholder="placeholder"
      :required="true"
      @keydown.enter="submit"
    />
    <div class="ext:mt-6 ext:flex ext:justify-end ext:gap-3">
      <oc-button variant="passive" @click="cancel">
        {{ $gettext('Cancel') }}
      </oc-button>
      <oc-button variant="primary" :disabled="!internalValue.trim()" @click="submit">
        {{ confirmText }}
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useModals } from '@opencloud-eu/web-pkg'

const props = defineProps<{
  defaultValue: string
  label: string
  placeholder: string
  confirmText: string
  actionCallback: (val: string) => void
  cancelCallback: () => void
}>()

const { closeModal } = useModals()
const internalValue = ref(props.defaultValue)

const submit = () => {
  if (internalValue.value.trim()) {
    props.actionCallback(internalValue.value.trim())
    closeModal()
  }
}

const cancel = () => {
  props.cancelCallback()
  closeModal()
}
</script>