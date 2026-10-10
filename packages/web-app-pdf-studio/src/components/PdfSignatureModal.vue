<template>
  <div class="pdf-studio-signature ext:flex ext:flex-col ext:gap-3">
    <div
      class="oc-button-group ext:w-full"
      role="tablist"
      :aria-label="$gettext('Signature')"
      @keydown.left.prevent="moveTab(-1)"
      @keydown.right.prevent="moveTab(1)"
    >
      <oc-button
        v-for="tab in tabs"
        :id="`pdf-studio-signature-tab-${tab.id}`"
        :key="tab.id"
        :class="[
          `pdf-studio-signature-tab-${tab.id}`,
          'ext:flex-1 ext:justify-center ext:px-2.5 ext:py-1.5 ext:text-sm'
        ]"
        :aria-selected="activeTab === tab.id"
        aria-controls="pdf-studio-signature-panel"
        :tabindex="activeTab === tab.id ? 0 : -1"
        role="tab"
        :appearance="activeTab === tab.id ? 'filled' : 'raw'"
        :color-role="activeTab === tab.id ? 'secondaryContainer' : 'secondary'"
        :no-hover="activeTab === tab.id"
        @click="selectTab(tab.id)"
      >
        <span v-text="tab.label" />
      </oc-button>
    </div>

    <div
      id="pdf-studio-signature-panel"
      class="ext:flex ext:h-56 ext:flex-col ext:rounded-xl ext:bg-role-surface-container ext:p-3"
      role="tabpanel"
      :aria-labelledby="`pdf-studio-signature-tab-${activeTab}`"
    >
      <div
        v-if="activeTab !== 'image'"
        class="ext:relative ext:flex-1 ext:overflow-hidden ext:rounded-lg ext:bg-white ext:text-black ext:shadow-sm ext:has-[input:focus-visible]:outline-2 ext:has-[input:focus-visible]:outline-role-secondary"
      >
        <div
          class="ext:pointer-events-none ext:absolute ext:inset-x-8 ext:bottom-10 ext:border-b ext:border-gray-300 ext:pb-1 ext:text-lg ext:leading-none ext:text-gray-400"
          aria-hidden="true"
          v-text="'×'"
        />
        <pdf-signature-draw v-if="activeTab === 'draw'" v-model="drawnCurves" />
        <oc-text-input
          v-else
          id="pdf-studio-signature-name"
          ref="typeInput"
          v-model="typedText"
          class="pdf-studio-signature-type ext:absolute ext:inset-x-10 ext:bottom-11"
          :label="$gettext('Your name')"
          :placeholder="$gettext('Your name')"
          :has-border="false"
        >
          <template #label>
            <label
              class="ext:sr-only"
              for="pdf-studio-signature-name"
              v-text="$gettext('Your name')"
            />
          </template>
        </oc-text-input>
      </div>

      <pdf-signature-image
        v-else
        v-model:data="imageData"
        v-model:file-name="imageName"
        :get-from-image="getFromImage"
      />
    </div>
    <p
      v-if="signatureError"
      class="pdf-studio-signature-error ext:text-sm ext:text-role-error"
      role="alert"
      v-text="signatureError"
    />
    <pdf-signature-options
      v-model:description="description"
      v-model:is-saved="isSaved"
      :can-save="canSave"
      :disabled="!hasSignature"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, unref, useTemplateRef, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Modal } from '@opencloud-eu/web-pkg'
import PdfSignatureOptions from './PdfSignatureOptions.vue'
import PdfSignatureImage from './PdfSignatureImage.vue'
import PdfSignatureDraw from './PdfSignatureDraw.vue'
import type { DrawnCurves, SignatureData } from '../composables/usePdfSignature'

const {
  getDrawnSignature,
  getFromText,
  getFromImage,
  onSave,
  canSave = false
} = defineProps<{
  modal: Modal
  /** There's room to save the signature for reuse. */
  canSave?: boolean
  getDrawnSignature: (curves: DrawnCurves) => SignatureData | null
  getFromText: (text: string, style: CSSStyleDeclaration) => SignatureData | null
  getFromImage: (file: File) => Promise<SignatureData | null>
  onSave: (data: SignatureData, description: string, isSaved: boolean) => Promise<void> | void
}>()

const isSaved = ref(canSave)

const emit = defineEmits<{ 'update:confirmDisabled': [value: boolean] }>()

const { $gettext, $pgettext } = useGettext()

type Tab = 'draw' | 'type' | 'image'
const tabs = computed<{ id: Tab; label: string }[]>(() => [
  { id: 'type', label: $pgettext('Signature tab', 'Type') },
  { id: 'draw', label: $pgettext('Signature tab', 'Draw') },
  { id: 'image', label: $pgettext('Signature tab', 'Image') }
])
// Same order and first tab as in the PDF.js viewer.
const activeTab = ref<Tab>('type')

const drawnCurves = ref<DrawnCurves>()

// Type: PDF.js turns the text into an outline using the font of the input.
const typeInput = useTemplateRef<{ $el: HTMLElement }>('typeInput')
const typedText = ref('')

async function selectTab(tab: Tab) {
  activeTab.value = tab
  // Ready to type the name.
  if (tab === 'type') {
    await nextTick()
    unref(typeInput)?.$el.querySelector('input')?.focus()
  }
}

/** Arrow keys switch tabs, like in tab lists elsewhere. */
async function moveTab(step: number) {
  const ids = unref(tabs).map(({ id }) => id)
  const index = (ids.indexOf(unref(activeTab)) + step + ids.length) % ids.length
  activeTab.value = ids[index]
  await nextTick()
  document.getElementById(`pdf-studio-signature-tab-${ids[index]}`)?.focus()
}

// Image: PDF.js extracts the signature from the picture, see PdfSignatureImage.
// shallowRef: PDF.js objects use private fields, which don't work through Vue's proxies.
const imageData = shallowRef<SignatureData | null>(null)
const imageName = ref('')
const signatureError = ref('')

const hasSignature = computed(() => {
  switch (unref(activeTab)) {
    case 'draw':
      return !!unref(drawnCurves)?.curves.length
    case 'type':
      return !!unref(typedText).trim()
    default:
      return !!unref(imageData)
  }
})

watch(hasSignature, (value) => emit('update:confirmDisabled', !value), { immediate: true })

function getSignatureData() {
  switch (unref(activeTab)) {
    case 'draw':
      return getDrawnSignature(unref(drawnCurves))
    case 'type': {
      const input = unref(typeInput)?.$el.querySelector('input')
      return getFromText(unref(typedText).trim(), window.getComputedStyle(input))
    }
    default:
      return unref(imageData)
  }
}

// Read out by screen readers instead of the signature and shown with saved signatures. Each tab
// has its own, by default like in the PDF.js viewer until the user changes it.
const editedDescriptions = reactive<Partial<Record<Tab, string>>>({})

function getDefaultDescription(tab: Tab) {
  switch (tab) {
    case 'type':
      return unref(typedText).trim()
    case 'image':
      return unref(imageName)
    default:
      return unref(drawnCurves) ? $gettext('Signature') : ''
  }
}

// Back at the default, it follows again, like in the PDF.js viewer. Cleared, it stays empty.
const description = computed({
  get: () => editedDescriptions[unref(activeTab)] ?? getDefaultDescription(unref(activeTab)),
  // The clear button of the input sets null.
  set: (value: string | null) => {
    const tab = unref(activeTab)
    if (value === getDefaultDescription(tab)) {
      delete editedDescriptions[tab]
      return
    }
    editedDescriptions[tab] = value ?? ''
  }
})

async function onConfirm() {
  const data = getSignatureData()
  if (!data) {
    // E.g. a font that draws nothing. Throwing keeps the dialog open.
    signatureError.value = $gettext('No signature could be created from this, please try again.')
    throw new Error('No signature data')
  }
  await onSave(data, unref(description).trim(), unref(isSaved) && canSave)
}

// A new drawing or image gets the default description again if it was cleared, like in the
// PDF.js viewer.
watch(
  () => !!unref(drawnCurves),
  (hasDrawing) => {
    if (hasDrawing && editedDescriptions.draw === '') {
      delete editedDescriptions.draw
    }
  }
)
watch(imageData, (data) => {
  if (data && editedDescriptions.image === '') {
    delete editedDescriptions.image
  }
})

watch([activeTab, () => unref(drawnCurves)?.curves.length, typedText], () => {
  signatureError.value = ''
})

defineExpose({ onConfirm })
</script>

<style scoped>
/*
 * PDF.js turns a typed signature into an outline using the font of this input, so it gets the
 * same handwriting fonts as in the PDF.js viewer instead of the OpenCloud UI font.
 */
.pdf-studio-signature-type :deep(input) {
  font-family:
    'Brush script', 'Apple Chancery', 'Segoe script', 'Freestyle Script', 'Palace Script MT',
    'Brush Script MT', TK, cursive, serif;
  font-size: 1.75rem;
  font-style: italic;
  height: 4rem;
  text-align: center;
  /* On white paper also in the dark theme */
  color: #000;
}

.pdf-studio-signature-type :deep(input::placeholder) {
  color: #6b7280;
}
</style>
