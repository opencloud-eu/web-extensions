<template>
  <div class="pdf-studio-signature-options ext:flex ext:flex-col ext:gap-3">
    <oc-text-input
      v-model="description"
      class="pdf-studio-signature-description"
      :label="$gettext('Description (alt text)')"
      :disabled="disabled"
      clear-button-enabled
    />
    <div class="ext:flex ext:justify-end">
      <oc-switch
        v-model:checked="isSaved"
        class="pdf-studio-signature-save ext:inline-flex"
        :label="$gettext('Save signature')"
        :disabled="disabled || !canSave"
      >
        <oc-contextual-helper
          v-if="!canSave"
          :title="$gettext('Save signature')"
          :text="
            $gettext(
              'You’ve reached the limit of %{max} saved signatures. Remove one to save more.',
              {
                max: String(MAX_SIGNATURES)
              }
            )
          "
        />
      </oc-switch>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MAX_SIGNATURES } from '../composables/usePdfSignatureStorage'

const { canSave = false, disabled = false } = defineProps<{
  /** There's room to save the signature for reuse. */
  canSave?: boolean
  /** No signature yet. */
  disabled?: boolean
}>()

const description = defineModel<string>('description', { required: true })
const isSaved = defineModel<boolean>('isSaved', { required: true })
</script>
