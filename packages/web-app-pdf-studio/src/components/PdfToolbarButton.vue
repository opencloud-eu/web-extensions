<template>
  <oc-button
    v-oc-tooltip="label"
    :aria-label="label"
    :aria-pressed="hasDropdown ? undefined : isActive"
    :disabled="disabled"
    :show-spinner="showSpinner"
    class="ext:inline-flex ext:min-w-9 ext:items-center ext:justify-center ext:p-2"
    :class="{
      'ext:bg-role-secondary-container ext:forced-colors:bg-[Highlight] ext:forced-colors:text-[HighlightText] ext:forced-colors:[&_svg]:fill-[HighlightText]':
        isActive
    }"
    appearance="raw"
    gap-size="none"
  >
    <slot>
      <oc-icon v-if="!showSpinner" :name="icon" :fill-type="fillType" size-class="ext:size-4" />
    </slot>
    <oc-icon v-if="hasDropdown" name="arrow-down-s" fill-type="line" size-class="ext:size-4" />
  </oc-button>
</template>

<script setup lang="ts">
// Like the buttons in OpenCloud's text editor toolbar, a bit narrower so the toolbar fits into
// one row on common screen sizes. Pressed ones are highlighted also in forced colors mode,
// like in the PDF.js viewer.
const {
  label,
  icon = undefined,
  fillType = 'line',
  isActive = undefined,
  hasDropdown = false,
  disabled = false,
  showSpinner = false
} = defineProps<{
  label: string
  /** Shown unless there is content instead. */
  icon?: string
  fillType?: 'line' | 'fill' | 'none'
  /** Renders a toggle button when set. */
  isActive?: boolean
  /** Adds a chevron, for buttons that open a drop. */
  hasDropdown?: boolean
  disabled?: boolean
  showSpinner?: boolean
}>()
</script>
