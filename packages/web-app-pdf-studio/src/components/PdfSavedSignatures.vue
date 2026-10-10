<template>
  <oc-list ref="list" class="pdf-studio-saved-signatures">
    <li
      v-for="({ signature, viewBox, path }, index) in previews"
      :key="signature.uuid"
      class="pdf-studio-saved-signature ext:flex ext:items-center ext:gap-1"
    >
      <oc-button
        class="ext:min-w-0 ext:flex-1 ext:p-0 ext:pr-2"
        :aria-label="
          $gettext('Saved signature: %{description}', { description: signature.description })
        "
        appearance="raw-inverse"
        color-role="surface"
        justify-content="left"
        gap-size="none"
        @click="emit('add', signature)"
      >
        <svg
          class="ext:h-10 ext:w-28 ext:shrink-0 ext:rounded ext:bg-role-surface-container ext:p-1"
          :viewBox="viewBox"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path
            :d="path"
            class="ext:stroke-current"
            :class="signature.areContours ? 'ext:fill-current' : 'ext:fill-none'"
            :stroke-width="signature.areContours ? 0.5 : 1"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </svg>
        <span class="ext:truncate ext:pl-1" v-text="signature.description" />
      </oc-button>
      <oc-button
        v-oc-tooltip="$gettext('Remove saved signature')"
        class="pdf-studio-remove-signature ext:w-auto! ext:shrink-0 ext:p-2"
        :aria-label="
          $gettext('Remove saved signature: %{description}', {
            description: signature.description
          })
        "
        appearance="raw-inverse"
        color-role="surface"
        gap-size="none"
        @click="remove(signature.uuid, index)"
      >
        <oc-icon name="delete-bin" fill-type="line" size-class="ext:size-4" />
      </oc-button>
    </li>
    <pdf-menu-item
      v-if="hasAddNew"
      class="pdf-studio-add-signature"
      :label="$gettext('Add new signature')"
      icon="add"
      @click="emit('addNew')"
    />
  </oc-list>
</template>

<script setup lang="ts">
import { computed, unref, useTemplateRef, watch } from 'vue'
import { SignatureExtractor } from 'pdfjs-dist'
import type { SavedSignature } from '../composables/usePdfSignatureStorage'
import PdfMenuItem from './PdfMenuItem.vue'

const { signatures, hasAddNew = true } = defineProps<{
  signatures: SavedSignature[]
  /** False where adding a new signature is offered elsewhere. */
  hasAddNew?: boolean
}>()

const emit = defineEmits<{
  add: [signature: SavedSignature]
  remove: [uuid: string]
  addNew: []
}>()

const list = useTemplateRef<{ $el: HTMLElement }>('list')
let removedIndex: number | undefined

function remove(uuid: string, index: number) {
  removedIndex = index
  emit('remove', uuid)
}

// The focus was on the removed entry, it moves to the next one (or the one before, or "Add new").
watch(
  () => signatures,
  () => {
    if (removedIndex === undefined) {
      return
    }
    const buttons = unref(list).$el.querySelectorAll<HTMLElement>('.pdf-studio-remove-signature')
    const button = buttons[Math.min(removedIndex, buttons.length - 1)]
    removedIndex = undefined
    ;(button ?? unref(list).$el.querySelector<HTMLElement>('.pdf-studio-add-signature'))?.focus()
  },
  { flush: 'post' }
)

// The outline of each signature as an SVG path, the same way the PDF.js viewer draws them.
const previews = computed(() =>
  signatures.flatMap((signature) => {
    const { lines, areContours } = signature
    const maxDim = Math.max(lines.width, lines.height)
    const outline = SignatureExtractor.processDrawnLines({
      lines,
      pageWidth: maxDim,
      pageHeight: maxDim,
      rotation: 0,
      innerMargin: 0,
      mustSmooth: false,
      areContours
    })?.outline
    return outline ? [{ signature, viewBox: outline.viewBox, path: outline.toSVGPath() }] : []
  })
)
</script>
