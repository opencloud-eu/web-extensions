<template>
  <teleport to="body">
    <div
      ref="rootEl"
      role="dialog"
      aria-modal="true"
      :aria-label="photo.name"
      tabindex="-1"
      class="ext:fixed ext:inset-0 ext:z-50 ext:flex ext:flex-col ext:bg-black/95 ext:outline-none"
      @click.self="emit('close')"
    >
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
            :class="buttonClasses"
            :aria-label="playing ? $gettext('Pause slideshow') : $gettext('Start slideshow')"
            @click="toggleSlideshow"
          >
            <oc-icon :name="playing ? 'pause' : 'play'" fill-type="line" />
          </button>
          <button
            type="button"
            :class="buttonClasses"
            :aria-label="$gettext('Close')"
            @click="emit('close')"
          >
            <oc-icon name="close" fill-type="line" />
          </button>
        </div>
      </div>

      <div
        ref="stageEl"
        class="ext:relative ext:min-h-0 ext:flex-1 ext:touch-none ext:overflow-hidden"
        :class="
          dragging || mouseSwipeActive
            ? 'ext:cursor-grabbing'
            : zoomed || ctrlHeld
              ? 'ext:cursor-grab'
              : ''
        "
        @click.self="onStageClick"
        @pointerdown="onStagePointerDown"
        @touchstart.passive="onStageTouchStart"
        @touchmove="zoomTouchMove"
        @touchend.passive="onStageTouchEnd"
        @touchcancel.passive="zoomTouchEnd"
        @wheel="zoomWheel"
      >
        <!-- the layers crossfade once the next image finished decoding -->
        <div class="ext:pointer-events-none ext:absolute ext:inset-0" :style="transformStyle">
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
          <video
            v-if="motionVideoUrl && motionPlaying"
            :src="motionVideoUrl"
            class="ext:absolute ext:inset-0 ext:h-full ext:w-full ext:object-contain"
            :loop="motionLoop"
            autoplay
            muted
            playsinline
            @ended="motionPlaying = false"
          />
        </div>
        <oc-spinner
          v-if="showLoading"
          size="small"
          class="ext:absolute ext:right-4 ext:bottom-4 ext:text-white"
          :aria-label="$gettext('Loading')"
        />
        <button
          v-if="zoomed && originalState === 'idle'"
          type="button"
          :class="buttonClasses"
          class="ext:absolute ext:bottom-4 ext:left-1/2 ext:-translate-x-1/2 ext:px-3 ext:text-sm"
          @click.stop="upgradeToOriginal"
        >
          {{ loadOriginalLabel }}
        </button>

        <motion-photo-badge
          v-if="photo.motionPhoto"
          class="ext:absolute ext:bottom-4 ext:left-4"
          size="large"
          interactive
          :loading="motionLoading"
          :icon="motionPlaying ? 'pause-circle' : 'play-circle'"
          :label="motionPlaying ? $gettext('Pause motion photo') : $gettext('Loop motion photo')"
          @click.stop.prevent="toggleMotion"
        />
        <button
          v-if="hasPrev"
          type="button"
          :class="buttonClasses"
          class="ext:absolute ext:top-1/2 ext:left-4 ext:-translate-y-1/2"
          :aria-label="$gettext('Previous photo')"
          @click="emit('prev')"
        >
          <oc-icon name="arrow-left-s" size="large" fill-type="line" />
        </button>
        <button
          v-if="hasNext"
          type="button"
          :class="buttonClasses"
          class="ext:absolute ext:top-1/2 ext:right-4 ext:-translate-y-1/2"
          :aria-label="$gettext('Next photo')"
          @click="emit('next')"
        >
          <oc-icon name="arrow-right-s" size="large" fill-type="line" />
        </button>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useLightboxZoom } from '../composables/useLightboxZoom'
import {
  MotionPhotoBadge,
  useLoadingService,
  useMotionPhoto,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import { Photo } from '../types'
import { formatBytes, formatTileTime } from '../helpers'
import { useGraphSearch } from '../composables/useGraphSearch'

const SLIDE_MS = 5000
const TICK_MS = 100

const buttonClasses =
  'ext:inline-flex ext:cursor-pointer ext:items-center ext:justify-center ext:rounded-full ext:border-0 ext:bg-white/10 ext:p-2 ext:text-white ext:hover:bg-white/25'

const {
  photo,
  hasPrev,
  hasNext,
  preload = null
} = defineProps<{
  photo: Photo
  hasPrev: boolean
  hasNext: boolean
  /** upcoming photo, its large rendition is fetched ahead of time */
  preload?: Photo | null
}>()

const emit = defineEmits<{ close: []; prev: []; next: []; rewind: [] }>()

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const {
  zoomed,
  dragging,
  transformStyle,
  reset: resetZoom,
  onTouchStart: zoomTouchStart,
  onTouchMove: zoomTouchMove,
  onTouchEnd: zoomTouchEnd,
  onWheel: zoomWheel,
  onPointerDown: zoomPointerDown,
  consumeDragClick,
  dispose: disposeZoom
} = useLightboxZoom(stageEl)

function onStageClick() {
  if (consumeDragClick() || consumeMouseSwipe()) {
    return
  }
  emit('close')
}

// a held ctrl advertises the gesture mode (ctrl+wheel zooms, dragging pans
// and pages), so surface the grab cursor while it is down
const ctrlHeld = ref(false)
const onModifierDown = (event: KeyboardEvent) => {
  if (event.key === 'Control') {
    ctrlHeld.value = true
  }
}
const onModifierUp = (event: KeyboardEvent) => {
  if (event.key === 'Control') {
    ctrlHeld.value = false
  }
}
const onWindowBlur = () => {
  ctrlHeld.value = false
}
onMounted(() => {
  window.addEventListener('keydown', onModifierDown)
  window.addEventListener('keyup', onModifierUp)
  window.addEventListener('blur', onWindowBlur)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onModifierDown)
  window.removeEventListener('keyup', onModifierUp)
  window.removeEventListener('blur', onWindowBlur)
})

// mouse drags on the unzoomed photo mirror the touch swipes
let mouseSwipeStartX = 0
let mouseSwipeStartY = 0
const mouseSwipeActive = ref(false)
let suppressStageClick = false

function consumeMouseSwipe(): boolean {
  const consumed = suppressStageClick
  suppressStageClick = false
  return consumed
}

function onMouseSwipeUp(event: PointerEvent) {
  if (!mouseSwipeActive.value) {
    return
  }
  mouseSwipeActive.value = false
  const dx = event.clientX - mouseSwipeStartX
  const dy = event.clientY - mouseSwipeStartY
  if (Math.hypot(dx, dy) > 4) {
    suppressStageClick = true
  }
  applySwipe(dx, dy)
}

function onStagePointerDown(event: PointerEvent) {
  zoomPointerDown(event)
  if (event.pointerType !== 'mouse' || event.button !== 0 || zoomed.value) {
    return
  }
  mouseSwipeActive.value = true
  mouseSwipeStartX = event.clientX
  mouseSwipeStartY = event.clientY
  window.addEventListener('pointerup', onMouseSwipeUp, { once: true })
}

onBeforeUnmount(() => window.removeEventListener('pointerup', onMouseSwipeUp))

onBeforeUnmount(() => disposeZoom())

watch(
  () => photo.id,
  () => resetZoom()
)

function onStageTouchStart(event: TouchEvent) {
  zoomTouchStart(event)
  onTouchStart(event)
}

function onStageTouchEnd(event: TouchEvent) {
  zoomTouchEnd(event)
  onTouchEnd(event)
}

// swipe navigation: horizontal swipes step, a downward swipe closes; short
// movements stay taps and keep hitting the click handlers
const SWIPE_STEP_PX = 48
const SWIPE_CLOSE_PX = 64
let touchStartX = 0
let touchStartY = 0
let touchActive = false

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) {
    touchActive = false
    return
  }
  touchActive = true
  touchStartX = event.touches[0].clientX
  touchStartY = event.touches[0].clientY
}

function applySwipe(dx: number, dy: number) {
  if (Math.abs(dx) > SWIPE_STEP_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0 && hasNext) {
      emit('next')
    } else if (dx > 0 && hasPrev) {
      emit('prev')
    }
    return
  }
  if (dy > SWIPE_CLOSE_PX && Math.abs(dy) > Math.abs(dx) * 1.5) {
    emit('close')
  }
}

function onTouchEnd(event: TouchEvent) {
  if (!touchActive) {
    return
  }
  touchActive = false
  if (zoomed.value) {
    // a single finger pans the zoomed photo, it must not page or close
    return
  }
  const touch = event.changedTouches[0]
  applySwipe(touch.clientX - touchStartX, touch.clientY - touchStartY)
}

const { $gettext, interpolate, current: currentLanguage } = useGettext()
const { loadLightboxImage, loadOriginalImage } = useGraphSearch()
const loadingService = useLoadingService()

// front/back alternate; the hidden layer receives the next image and the
// visibility flips only after decoding finished
const frontUrl = ref<string | undefined>()
const backUrl = ref<string | undefined>()
const frontVisible = ref(true)
const showLoading = ref(false)
let loadingTimer: ReturnType<typeof setTimeout> | undefined

// Zooming into the preset-sized preview turns to mush; the original loads on
// explicit request only (typical gains are modest and files can be huge).
const originalState = ref<'idle' | 'loading' | 'shown' | 'failed'>('idle')

/** decode url off-screen, then crossfade it in. swapOnDecodeFailure controls
 * the broken-image case: a photo CHANGE swaps anyway (an empty stage beats a
 * stale photo), the original UPGRADE keeps the preview instead. Returns true
 * only for a swapped, decodable image. */
async function crossfadeTo(
  url: string | undefined,
  forPhotoId: string,
  swapOnDecodeFailure: boolean
): Promise<boolean> {
  let decoded = true
  if (url) {
    const probe = new Image()
    probe.src = url
    try {
      await probe.decode()
    } catch {
      decoded = false
    }
  }
  if (photo.id !== forPhotoId || (!decoded && !swapOnDecodeFailure)) {
    return false
  }
  if (unref(frontVisible)) {
    backUrl.value = url
  } else {
    frontUrl.value = url
  }
  frontVisible.value = !unref(frontVisible)
  return decoded
}

watch(
  () => photo,
  async (current) => {
    originalState.value = 'idle'
    clearTimeout(loadingTimer)
    loadingTimer = setTimeout(() => (showLoading.value = true), 300)
    const url = (await loadLightboxImage(current)) ?? current.thumbnailUrl
    // the user may have navigated on while the rendition loaded
    if (photo.id !== current.id) {
      return
    }
    await crossfadeTo(url, current.id, true)
    if (photo.id !== current.id) {
      return
    }
    clearTimeout(loadingTimer)
    showLoading.value = false
  },
  { immediate: true }
)

const loadOriginalLabel = computed(() =>
  photo.size
    ? interpolate($gettext('Load original · %{ size }'), {
        size: formatBytes(photo.size, currentLanguage)
      })
    : $gettext('Load original')
)

async function upgradeToOriginal() {
  if (originalState.value !== 'idle') {
    return
  }
  const current = photo.id
  originalState.value = 'loading'
  clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => (showLoading.value = true), 300)
  const url = await loadOriginalImage(photo)
  if (photo.id !== current) {
    return
  }
  clearTimeout(loadingTimer)
  showLoading.value = false
  if (!url) {
    originalState.value = 'failed'
    return
  }
  const swapped = await crossfadeTo(url, current, false)
  if (photo.id === current) {
    originalState.value = swapped ? 'shown' : 'failed'
  }
}

watch(
  () => preload,
  (upcoming) => {
    if (upcoming) {
      loadLightboxImage(upcoming)
    }
  },
  { immediate: true }
)

// the slideshow feeds a loading task, so the runtime's standard progress bar
// (and extensions like the nyan cat) render it; warnBeforeUnload keeps the
// browser's unload confirmation away
const slideshowTaskOptions = { debounceTime: 0, indeterminate: false, warnBeforeUnload: false }
const ADVANCE_TIMEOUT_MS = 10000

const playing = ref(false)
let slideStart = 0
let advancing = false
let advanceStart = 0
let tickTimer: ReturnType<typeof setInterval> | undefined
let reportProgress: ((state: { total: number; current: number }) => void) | undefined
let finishTask: (() => void) | undefined

function tick() {
  const elapsed = Math.min(Date.now() - slideStart, SLIDE_MS)
  reportProgress?.({ total: SLIDE_MS, current: elapsed })
  if (advancing) {
    // watchdog: a failed step (fill error at a month boundary) never changes
    // the photo, without this the slideshow would freeze on advancing
    if (Date.now() - advanceStart > ADVANCE_TIMEOUT_MS) {
      advancing = false
      slideStart = Date.now()
    }
    return
  }
  if (elapsed < SLIDE_MS) {
    return
  }
  // a running motion clip finishes before the slideshow moves on
  if (unref(motionPlaying)) {
    return
  }
  if (!hasNext) {
    // the slideshow loops; with nothing to rewind to it just replays the slide
    if (!hasPrev) {
      slideStart = Date.now()
      return
    }
    advancing = true
    advanceStart = Date.now()
    emit('rewind')
    return
  }
  advancing = true
  advanceStart = Date.now()
  emit('next')
}

function startSlideshow() {
  // a looping clip would hold the first slide forever
  if (unref(motionLoop)) {
    stopMotion()
  }
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

// the embedded clip plays once over the still; the badge switches to
// looping playback (and pauses a running slideshow while it loops)
const { canPlay: canPlayMotion, loadVideoUrl } = useMotionPhoto()
const spacesStore = useSpacesStore()
const motionPlaying = ref(false)
const motionLoading = ref(false)
const motionLoop = ref(false)
const motionVideoUrl = ref<string | undefined>()
let motionAbort: AbortController | undefined

function motionResourceFor(p: Photo) {
  return {
    id: p.id,
    fileId: p.id,
    path: `/${p.parentPath ? `${p.parentPath}/${p.name}` : p.name}`,
    size: p.size,
    motionPhoto: p.motionPhoto
  }
}

async function playMotion(loop = false) {
  motionLoop.value = loop
  const current = photo
  const space = spacesStore.spaces.find((s) => s.id === current.driveId)
  const resource = motionResourceFor(current)
  if (!space || !canPlayMotion(resource)) {
    return
  }
  motionAbort?.abort()
  const abort = new AbortController()
  motionAbort = abort
  motionLoading.value = true
  try {
    const url = await loadVideoUrl(space, resource, abort.signal)
    if (photo.id !== current.id || motionAbort !== abort) {
      return
    }
    motionVideoUrl.value = url
    motionPlaying.value = true
  } catch {
    // aborted or failed, the still stays
  } finally {
    // an aborted, superseded load must not clear the state of its successor
    if (motionAbort === abort) {
      motionLoading.value = false
    }
  }
}

function stopMotion() {
  motionAbort?.abort()
  motionPlaying.value = false
  motionLoading.value = false
  motionLoop.value = false
}

function toggleMotion() {
  if (unref(motionPlaying)) {
    stopMotion()
    return
  }
  if (unref(motionLoading)) {
    // adopt the in-flight download instead of aborting and restarting it
    motionLoop.value = true
    return
  }
  if (unref(playing)) {
    stopSlideshow()
  }
  playMotion(true)
}

watch(
  () => photo.id,
  () => {
    stopMotion()
    motionVideoUrl.value = undefined
    if (photo.motionPhoto) {
      playMotion()
    }
  },
  { immediate: true }
)

// modal focus trap: Tab cycles through the lightbox controls only
function trapTab(event: KeyboardEvent) {
  const focusables = [
    ...(rootEl.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
  ]
  if (!focusables.length) {
    event.preventDefault()
    return
  }
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === rootEl.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || active === rootEl.value)) {
    event.preventDefault()
    first.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      emit('close')
      break
    case 'Tab':
      trapTab(event)
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

// browser/mobile Back closes the lightbox instead of leaving the timeline:
// opening pushes a marker entry, popping it (back button) closes, and a close
// through the UI consumes the leftover entry
const onPopstate = () => emit('close')
let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  previouslyFocused = document.activeElement as HTMLElement | null
  rootEl.value?.focus()
  history.pushState({ ...(history.state ?? {}), photosLightbox: true }, '')
  window.addEventListener('popstate', onPopstate)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('popstate', onPopstate)
  if (history.state?.photosLightbox) {
    history.back()
  }
  // preventScroll: closing already scrolls the timeline to the current photo,
  // refocusing the opening tile must not fight that
  previouslyFocused?.focus({ preventScroll: true })
  clearTimeout(loadingTimer)
  stopSlideshow()
})
</script>
