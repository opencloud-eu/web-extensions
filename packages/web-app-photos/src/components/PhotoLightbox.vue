<template>
  <teleport to="body">
    <div
      class="ext:fixed ext:inset-0 ext:z-50 ext:flex ext:flex-col ext:bg-black/95"
      @click.self="emit('close')"
    >
      <!-- top bar: caption + close -->
      <div class="ext:flex ext:items-center ext:justify-between ext:px-4 ext:py-3 ext:text-white">
        <div class="ext:min-w-0">
          <div class="ext:truncate ext:text-sm ext:font-medium">{{ photo.name }}</div>
          <div class="ext:text-xs ext:opacity-70">
            {{ formatTileTime(photo.takenDateTime, currentLanguage) }}
          </div>
        </div>
        <div class="ext:flex ext:items-center ext:gap-2">
          <button
            type="button"
            class="lightbox-button"
            :aria-label="playing ? $gettext('Pause slideshow') : $gettext('Start slideshow')"
            @click="toggleSlideshow"
          >
            <oc-icon :name="playing ? 'pause' : 'play'" fill-type="line" />
          </button>
          <button
            type="button"
            class="lightbox-button"
            :aria-label="$gettext('Close')"
            @click="emit('close')"
          >
            <oc-icon name="close" fill-type="line" />
          </button>
        </div>
      </div>

      <!-- stage -->
      <div class="ext:relative ext:min-h-0 ext:flex-1" @click.self="emit('close')">
        <!-- two stacked layers crossfade: the old image stays up until the
             new one is fully decoded, so there is never a blurry pop-in -->
        <div class="ext:pointer-events-none ext:absolute ext:inset-0">
          <img
            v-if="frontUrl"
            :src="frontUrl"
            :alt="frontVisible ? photo.name : ''"
            class="ext:absolute ext:inset-0 ext:h-full ext:w-full ext:object-contain ext:transition-opacity ext:duration-300"
            :class="frontVisible ? 'ext:opacity-100' : 'ext:opacity-0'"
          />
          <img
            v-if="backUrl"
            :src="backUrl"
            :alt="frontVisible ? '' : photo.name"
            class="ext:absolute ext:inset-0 ext:h-full ext:w-full ext:object-contain ext:transition-opacity ext:duration-300"
            :class="frontVisible ? 'ext:opacity-0' : 'ext:opacity-100'"
          />
          <div
            v-if="!frontUrl && !backUrl"
            class="ext:absolute ext:inset-0 ext:m-auto ext:h-2/3 ext:w-2/3 ext:animate-pulse ext:rounded"
            :style="{ background: placeholderArtFor(photo.id) }"
          />
          <oc-spinner
            v-if="showLoading"
            size="small"
            class="ext:absolute ext:right-4 ext:bottom-4 ext:text-white"
            :aria-label="$gettext('Loading')"
          />
        </div>
        <button
          v-if="hasPrev"
          type="button"
          class="lightbox-button ext:absolute ext:top-1/2 ext:left-4 ext:-translate-y-1/2"
          :aria-label="$gettext('Previous photo')"
          @click="emit('prev')"
        >
          <oc-icon name="arrow-left-s" size="large" fill-type="line" />
        </button>
        <button
          v-if="hasNext"
          type="button"
          class="lightbox-button ext:absolute ext:top-1/2 ext:right-4 ext:-translate-y-1/2"
          :aria-label="$gettext('Next photo')"
          @click="emit('next')"
        >
          <oc-icon name="arrow-right-s" size="large" fill-type="line" />
        </button>
      </div>

      <!-- slideshow progress renders through the runtime's global progress
           bar (the standard extension point, fed via the loading service),
           so progress bar extensions like the nyan cat just work -->
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useLoadingService } from '@opencloud-eu/web-pkg'
import { MemoryPhoto } from '../types'
import { formatTileTime, placeholderArtFor } from '../helpers'
import { useGraphSearch } from '../composables/useGraphSearch'

const SLIDE_MS = 5000
const TICK_MS = 100

const {
  photo,
  hasPrev,
  hasNext,
  preload = null
} = defineProps<{
  photo: MemoryPhoto
  hasPrev: boolean
  hasNext: boolean
  /** upcoming photo, its large rendition is fetched ahead of time */
  preload?: MemoryPhoto | null
}>()

const emit = defineEmits<{ close: []; prev: []; next: [] }>()

const { $gettext, current: currentLanguage } = useGettext()
const { loadLightboxImage } = useGraphSearch()
const loadingService = useLoadingService()

// crossfade layers: front/back alternate, the hidden one receives the next
// image and the visibility flips only after decoding finished
const frontUrl = ref<string | undefined>()
const backUrl = ref<string | undefined>()
const frontVisible = ref(true)
const showLoading = ref(false)
let loadingTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => photo,
  async (current) => {
    clearTimeout(loadingTimer)
    loadingTimer = setTimeout(() => (showLoading.value = true), 300)
    const url = (await loadLightboxImage(current)) ?? current.thumbnailUrl
    // the user may have navigated on while the rendition loaded
    if (photo.id !== current.id) {
      return
    }
    if (url) {
      const probe = new Image()
      probe.src = url
      try {
        await probe.decode()
      } catch {
        // decoding failures still crossfade, just without the guarantee
      }
      if (photo.id !== current.id) {
        return
      }
    }
    if (unref(frontVisible)) {
      backUrl.value = url
    } else {
      frontUrl.value = url
    }
    frontVisible.value = !unref(frontVisible)
    clearTimeout(loadingTimer)
    showLoading.value = false
  },
  { immediate: true }
)
watch(
  () => preload,
  (upcoming) => {
    if (upcoming) {
      loadLightboxImage(upcoming)
    }
  },
  { immediate: true }
)

// slideshow: one non-indeterminate loading task per run feeds the loading
// service, which is what every progress bar implementation renders.
// warnBeforeUnload=false keeps the browser's "changes may not be saved"
// dialog away: a slideshow is not an unsaved operation. The option ships
// with the loading service patch in the web repo; older runtimes ignore it
// (spread through a variable, the published types do not know it yet).
const slideshowTaskOptions = { debounceTime: 0, indeterminate: false, warnBeforeUnload: false }
const playing = ref(false)
let slideStart = 0
let advancing = false
let tickTimer: ReturnType<typeof setInterval> | undefined
let reportProgress: ((state: { total: number; current: number }) => void) | undefined
let finishTask: (() => void) | undefined

function tick() {
  const elapsed = Math.min(Date.now() - slideStart, SLIDE_MS)
  reportProgress?.({ total: SLIDE_MS, current: elapsed })
  if (elapsed < SLIDE_MS || advancing) {
    return
  }
  if (!hasNext) {
    stopSlideshow()
    return
  }
  advancing = true
  emit('next')
}

function startSlideshow() {
  playing.value = true
  slideStart = Date.now()
  advancing = false
  loadingService.addTask(({ setProgress }) => {
    reportProgress = setProgress
    return new Promise<void>((resolve) => {
      finishTask = resolve
    })
  }, slideshowTaskOptions)
  tickTimer = setInterval(tick, TICK_MS)
}

function stopSlideshow() {
  playing.value = false
  clearInterval(tickTimer)
  tickTimer = undefined
  finishTask?.()
  finishTask = undefined
  reportProgress = undefined
}

function toggleSlideshow() {
  if (unref(playing)) {
    stopSlideshow()
  } else {
    startSlideshow()
  }
}

// a new photo restarts the slide interval
watch(
  () => photo.id,
  () => {
    slideStart = Date.now()
    advancing = false
  }
)

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      emit('close')
      break
    case 'ArrowLeft':
      if (hasPrev) {
        emit('prev')
      }
      break
    case 'ArrowRight':
      if (hasNext) {
        emit('next')
      }
      break
    case ' ':
      event.preventDefault()
      toggleSlideshow()
      break
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(loadingTimer)
  stopSlideshow()
})
</script>

<style scoped>
.lightbox-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border: 0;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.1);
  color: white;
  cursor: pointer;
}
.lightbox-button:hover {
  background: rgb(255 255 255 / 0.25);
}
</style>
