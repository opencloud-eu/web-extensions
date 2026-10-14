import { computed, ref, type Ref } from 'vue'

const MAX_ZOOM = 6
/** below this the zoom snaps back to the fitted view */
const SNAP_ZOOM = 1.05

/**
 * Pinch-to-zoom for the lightbox stage: two-finger pinch and ctrl+wheel
 * (how browsers report touchpad pinches) zoom around the gesture anchor,
 * a single finger pans while zoomed. All math is in screen pixels relative
 * to the stage center, matching `translate(pan) scale(zoom)` with the
 * default center transform origin.
 */
export function useLightboxZoom(stage: Ref<HTMLElement | null>) {
  const zoom = ref(1)
  const panX = ref(0)
  const panY = ref(0)

  const zoomed = computed(() => zoom.value > 1.001)

  const transformStyle = computed(() => ({
    transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
  }))

  function reset() {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  }

  function clampPan() {
    const el = stage.value
    if (!el) {
      return
    }
    const maxX = ((zoom.value - 1) * el.clientWidth) / 2
    const maxY = ((zoom.value - 1) * el.clientHeight) / 2
    panX.value = Math.min(maxX, Math.max(-maxX, panX.value))
    panY.value = Math.min(maxY, Math.max(-maxY, panY.value))
  }

  /** anchor is in screen px relative to the stage center */
  function applyZoom(next: number, anchorX: number, anchorY: number) {
    const target = Math.min(MAX_ZOOM, Math.max(1, next))
    const factor = target / zoom.value
    panX.value = anchorX - (anchorX - panX.value) * factor
    panY.value = anchorY - (anchorY - panY.value) * factor
    zoom.value = target
    if (zoom.value <= SNAP_ZOOM) {
      reset()
    }
    clampPan()
  }

  function stageCenterOffset(clientX: number, clientY: number): { x: number; y: number } {
    const rect = stage.value?.getBoundingClientRect()
    if (!rect) {
      return { x: 0, y: 0 }
    }
    return {
      x: clientX - rect.left - rect.width / 2,
      y: clientY - rect.top - rect.height / 2
    }
  }

  // mouse drag panning while zoomed
  const dragging = ref(false)
  let dragStartX = 0
  let dragStartY = 0
  let dragOriginX = 0
  let dragOriginY = 0
  let dragTravel = 0
  let suppressNextClick = false

  function onPointerMove(event: PointerEvent) {
    panX.value = dragOriginX + event.clientX - dragStartX
    panY.value = dragOriginY + event.clientY - dragStartY
    dragTravel = Math.max(
      dragTravel,
      Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY)
    )
    clampPan()
  }

  function onPointerUp() {
    dragging.value = false
    suppressNextClick = dragTravel > 4
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !zoomed.value) {
      return
    }
    event.preventDefault()
    dragging.value = true
    dragTravel = 0
    dragStartX = event.clientX
    dragStartY = event.clientY
    dragOriginX = panX.value
    dragOriginY = panY.value
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    // a cancelled pointer (e.g. the browser takes over the gesture) must end
    // the drag too, or the photo pans with plain mouse movement afterwards
    window.addEventListener('pointercancel', onPointerUp)
  }

  /** true once right after a drag: the click that follows a drag must not
   * count as a backdrop click */
  function consumeDragClick(): boolean {
    const consumed = suppressNextClick
    suppressNextClick = false
    return consumed
  }

  function dispose() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  // gesture state
  let pinchStartDistance = 0
  let pinchStartZoom = 1
  let panStartX = 0
  let panStartY = 0
  let panOriginX = 0
  let panOriginY = 0
  let panning = false

  function touchDistance(event: TouchEvent): number {
    const [a, b] = [event.touches[0], event.touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  function touchMidpoint(event: TouchEvent): { x: number; y: number } {
    const [a, b] = [event.touches[0], event.touches[1]]
    return stageCenterOffset((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
  }

  function onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      pinchStartDistance = touchDistance(event)
      pinchStartZoom = zoom.value
      panning = false
      return
    }
    if (event.touches.length === 1 && zoomed.value) {
      panning = true
      panStartX = event.touches[0].clientX
      panStartY = event.touches[0].clientY
      panOriginX = panX.value
      panOriginY = panY.value
    }
  }

  function onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && pinchStartDistance > 0) {
      event.preventDefault()
      const mid = touchMidpoint(event)
      applyZoom(pinchStartZoom * (touchDistance(event) / pinchStartDistance), mid.x, mid.y)
      return
    }
    if (event.touches.length === 1 && panning) {
      event.preventDefault()
      panX.value = panOriginX + event.touches[0].clientX - panStartX
      panY.value = panOriginY + event.touches[0].clientY - panStartY
      clampPan()
    }
  }

  function onTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      pinchStartDistance = 0
    }
    if (event.touches.length === 0) {
      panning = false
    }
  }

  /** browsers report touchpad pinches as ctrl+wheel; a held ctrl key plus a
   * real mouse wheel arrives here too. Normalize the wildly different delta
   * units (pixel/line/page mode, ~100px per wheel notch vs a few px per
   * touchpad tick) so one wheel notch zooms ~1.4x instead of jumping. */
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey) {
      return
    }
    event.preventDefault()
    let delta = event.deltaY
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      delta *= 16
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      delta *= 100
    }
    delta = Math.min(100, Math.max(-100, delta))
    const anchor = stageCenterOffset(event.clientX, event.clientY)
    applyZoom(zoom.value * Math.exp(-delta * 0.0035), anchor.x, anchor.y)
  }

  return {
    zoom,
    zoomed,
    dragging,
    transformStyle,
    reset,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
    onPointerDown,
    consumeDragClick,
    dispose
  }
}
