import { type Ref } from 'vue'
import { Photo } from '../types'
import { TimelineSection } from './usePhotoTimeline'

/** matches the scroll-margin under the sticky day header */
const HEADER_OFFSET = 48
const PURSUIT_DEADLINE_MS = 30000
const HOLD_MS = 4000

/**
 * Jump-to-photo with a glow: coarse jump to the month, park at the day
 * header once it renders, keep refining until the tile itself has paged in,
 * then hold it in place and keep the flash alive while surrounding months
 * fill and shift the layout. Manual scrolling cancels the pursuit.
 */
export function useScrollPursuit(options: {
  scroller: Ref<HTMLElement | null>
  /** positioned wrapper the glow overlay is appended to; outside the
   * scroller so nothing clips the glow at the container edges */
  host: Ref<HTMLElement | null>
  sectionEls: Map<string, HTMLElement>
  sections: Ref<TimelineSection[]>
  fillSection: (section: TimelineSection) => Promise<void>
  /** called after every programmatic scroll (keeps back-to-top in sync) */
  onScrolled: () => void
}) {
  const { scroller, host, sectionEls, sections, fillSection, onScrolled } = options

  // the active pursuit, cancellable from every other navigation
  let cancelActive: (() => void) | null = null

  /** make the jump target findable on a busy wall: an overlay OUTSIDE the
   * scroll container pulses a colored glow around the tile. The overlay is
   * layout-neutral (no hold-loop jitter) and immune to Vue re-renders. */
  function startFlashOverlay(hostEl: HTMLElement): {
    animation: Animation
    track: (tile: HTMLElement) => void
  } {
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:30;border-radius:3px;'
    hostEl.appendChild(overlay)
    const animation = overlay.animate(
      [
        { boxShadow: '0 0 0 0 transparent' },
        {
          boxShadow: '0 0 0 4px var(--oc-role-primary), 0 0 28px 10px var(--oc-role-primary)',
          offset: 0.4
        },
        { boxShadow: '0 0 0 0 transparent' }
      ],
      { duration: 1200, iterations: 3 }
    )
    animation.finished
      .catch((): undefined => undefined)
      .finally(() => {
        overlay.remove()
      })
    const track = (tile: HTMLElement) => {
      if (!overlay.isConnected) {
        return
      }
      const hostRect = hostEl.getBoundingClientRect()
      const rect = tile.getBoundingClientRect()
      overlay.style.left = `${rect.left - hostRect.left}px`
      overlay.style.top = `${rect.top - hostRect.top}px`
      overlay.style.width = `${rect.width}px`
      overlay.style.height = `${rect.height}px`
    }
    return { animation, track }
  }

  /** transform-independent offset of el within ancestor: rect-based math
   * would chase the flash animation and jitter the scroll position */
  function offsetTopWithin(el: HTMLElement, ancestor: HTMLElement): number {
    let top = 0
    let node: HTMLElement | null = el
    // the offsetParent chain skips the (unpositioned) scroll container and
    // ends at its positioned wrapper, which shares the scroller's top edge:
    // stop as soon as the chain leaves the container
    while (node && node !== ancestor && ancestor.contains(node)) {
      top += node.offsetTop
      node = node.offsetParent as HTMLElement | null
    }
    return top
  }

  async function scrollToPhoto(photo: Photo) {
    const container = scroller.value
    const monthKey = photo.takenDateTime.slice(0, 7)
    const monthEl = sectionEls.get(monthKey)
    if (!container || !monthEl) {
      return
    }

    // already fully in view (e.g. lightbox closed without wandering): only
    // glow, never yank the scroll position
    const tilePreview = monthEl.querySelector<HTMLElement>(
      `[data-photo-id="${CSS.escape(photo.id)}"]`
    )
    let align = true
    if (tilePreview) {
      const cRect = container.getBoundingClientRect()
      const rect = tilePreview.getBoundingClientRect()
      align = rect.top < cRect.top || rect.bottom > cRect.bottom
    }

    if (align) {
      container.scrollTop = monthEl.offsetTop
      onScrolled()

      const section = sections.value.find((s) => s.key === monthKey)
      if (section) {
        fillSection(section)
      }
    }

    cancelActive?.()
    let cancelled = false
    let flash: ReturnType<typeof startFlashOverlay> | undefined
    const cancel = () => {
      cancelled = true
      // remove the glow overlay right away: the pursuit loop may be sleeping
      // while the caller scrolls elsewhere, leaving the glow stranded
      flash?.animation.cancel()
      flash = undefined
    }
    cancelActive = cancel
    const cancelEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    cancelEvents.forEach((e) => container.addEventListener(e, cancel, { passive: true }))

    const tileSelector = `[data-photo-id="${CSS.escape(photo.id)}"]`
    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      })

    try {
      // pursuit: wait for the tile to page in, park at its day header
      // meanwhile. The deadline covers failed fills, which leave the section
      // unfilled and not filling and would otherwise spin this loop forever.
      const pursuitDeadline = performance.now() + PURSUIT_DEADLINE_MS
      const day = photo.takenDateTime.slice(0, 10)
      const section = sections.value.find((s) => s.key === monthKey)
      let atDayHeader = false
      let tile: HTMLElement | null = null
      while (!cancelled && align && performance.now() < pursuitDeadline) {
        tile = monthEl.querySelector<HTMLElement>(tileSelector)
        if (tile) {
          break
        }
        if (!atDayHeader) {
          const dayHeader = monthEl.querySelector<HTMLElement>(`#${CSS.escape(`day-${day}`)}`)
          if (dayHeader) {
            dayHeader.scrollIntoView({ block: 'start' })
            atDayHeader = true
          }
        }
        if (section && section.photos !== null && !section.filling) {
          return // fill finished, the tile genuinely is not there
        }
        await sleep(75)
      }

      // hold: keep the tile aligned and glowing while the layout settles
      const hostEl = host.value
      const holdUntil = performance.now() + HOLD_MS
      while (!cancelled && performance.now() < holdUntil) {
        tile = monthEl.querySelector<HTMLElement>(tileSelector)
        if (tile) {
          if (align) {
            const desired = offsetTopWithin(tile, container) - HEADER_OFFSET
            if (Math.abs(container.scrollTop - desired) > 4) {
              container.scrollTop = desired
              onScrolled()
            }
          }
          if (!flash && hostEl) {
            flash = startFlashOverlay(hostEl)
          }
          flash?.track(tile)
        }
        await sleep(150)
      }
      flash?.animation.cancel()
    } finally {
      cancelEvents.forEach((e) => container.removeEventListener(e, cancel))
      if (cancelActive === cancel) {
        cancelActive = null
      }
    }
  }

  function cancelPursuit() {
    cancelActive?.()
  }

  return { scrollToPhoto, cancelPursuit }
}
