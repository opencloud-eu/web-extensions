<template>
  <no-content-message
    v-if="isPasswordCancelled"
    class="pdf-studio-password-cancelled ext:absolute ext:inset-0 ext:p-4"
    icon="lock"
    icon-fill-type="line"
  >
    <template #message>
      <span v-text="$gettext('This PDF file is protected')" />
    </template>
    <template #callToAction>
      <oc-button
        ref="retryButton"
        class="pdf-studio-password-retry ext:mt-4"
        appearance="outline"
        @click="emit('retry')"
      >
        <span v-text="$gettext('Enter password')" />
      </oc-button>
    </template>
  </no-content-message>
  <no-content-message
    v-else-if="hasError"
    class="pdf-studio-load-error ext:absolute ext:inset-0 ext:p-4"
    icon="file-damage"
    icon-fill-type="line"
    role="alert"
  >
    <template #message>
      <span v-text="$gettext('The PDF file could not be opened')" />
    </template>
  </no-content-message>
  <app-loading-spinner v-else-if="isLoading" class="ext:absolute ext:inset-0" />
</template>

<script setup lang="ts">
import { nextTick, unref, useTemplateRef, watch } from 'vue'
import { AppLoadingSpinner, NoContentMessage } from '@opencloud-eu/web-pkg'

const {
  isLoading = false,
  hasError = false,
  isPasswordCancelled = false
} = defineProps<{
  isLoading?: boolean
  hasError?: boolean
  isPasswordCancelled?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const retryButton = useTemplateRef<{ $el: HTMLElement }>('retryButton')

// The focus was in the password dialog, which is gone now.
watch(
  () => isPasswordCancelled,
  async (isCancelled) => {
    if (isCancelled) {
      await nextTick()
      unref(retryButton)?.$el.focus()
    }
  }
)
</script>
