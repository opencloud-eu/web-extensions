import { computed, ref, unref, type Ref } from 'vue'
import { queryItemAsString, useRouteQuery } from '@opencloud-eu/web-pkg'
import { MemoryPhoto } from '../types'
import { TimelineSection } from './usePhotoTimeline'

/**
 * Lightbox state and navigation across the timeline's sections: stepping
 * fills neighboring months on demand, the current photo is mirrored into the
 * url (?photo= plus ?date=) and restored from it.
 */
export function useLightboxNavigation(
  sections: Ref<TimelineSection[]>,
  fillSection: (section: TimelineSection) => Promise<void>
) {
  const lightboxPhoto = ref<MemoryPhoto | null>(null)
  const photoQuery = useRouteQuery('photo')

  function locate(id: string): { sectionIdx: number; photoIdx: number } | null {
    for (let i = 0; i < unref(sections).length; i++) {
      const idx = unref(sections)[i].photos?.findIndex((p) => p.id === id) ?? -1
      if (idx >= 0) {
        return { sectionIdx: i, photoIdx: idx }
      }
    }
    return null
  }

  function neighborExists(dir: 1 | -1): boolean {
    const current = unref(lightboxPhoto)
    if (!current) {
      return false
    }
    const pos = locate(current.id)
    if (!pos) {
      return false
    }
    const photos = unref(sections)[pos.sectionIdx].photos ?? []
    const withinIdx = pos.photoIdx + dir
    if (withinIdx >= 0 && withinIdx < photos.length) {
      return true
    }
    for (let i = pos.sectionIdx + dir; i >= 0 && i < unref(sections).length; i += dir) {
      if (unref(sections)[i].count > 0) {
        return true
      }
    }
    return false
  }

  const hasNext = computed(() => neighborExists(1))
  const hasPrev = computed(() => neighborExists(-1))

  /** the upcoming photo when it is already loaded, for image prefetching */
  const preload = computed<MemoryPhoto | null>(() => {
    const current = unref(lightboxPhoto)
    if (!current) {
      return null
    }
    const pos = locate(current.id)
    if (!pos) {
      return null
    }
    const photos = unref(sections)[pos.sectionIdx].photos ?? []
    if (pos.photoIdx + 1 < photos.length) {
      return photos[pos.photoIdx + 1]
    }
    for (let i = pos.sectionIdx + 1; i < unref(sections).length; i++) {
      const list = unref(sections)[i].photos
      if (list?.length) {
        return list[0]
      }
      if (unref(sections)[i].count) {
        break
      }
    }
    return null
  })

  /** steps to the neighboring photo, filling months on the way as needed */
  async function flatStep(dir: 1 | -1): Promise<MemoryPhoto | null> {
    const current = unref(lightboxPhoto)
    if (!current) {
      return null
    }
    const pos = locate(current.id)
    if (!pos) {
      return null
    }
    const photos = unref(sections)[pos.sectionIdx].photos ?? []
    const withinIdx = pos.photoIdx + dir
    if (withinIdx >= 0 && withinIdx < photos.length) {
      return photos[withinIdx]
    }
    for (let i = pos.sectionIdx + dir; i >= 0 && i < unref(sections).length; i += dir) {
      const section = unref(sections)[i]
      if (!section.count) {
        continue
      }
      if (section.photos === null) {
        await fillSection(section)
      }
      const list = section.photos ?? []
      if (list.length) {
        return dir > 0 ? list[0] : list[list.length - 1]
      }
    }
    return null
  }

  function writePhotoParams(photo: MemoryPhoto | null) {
    const url = new URL(window.location.href)
    if (photo === null) {
      url.searchParams.delete('photo')
    } else {
      // the photo id plus its day: the day locates the month on restore,
      // the id picks the photo within it
      url.searchParams.set('photo', photo.id)
      const day = photo.takenDateTime?.slice(0, 10)
      if (day) {
        url.searchParams.set('date', day)
      }
    }
    window.history.replaceState({}, '', url.toString())
  }

  function open(photo: MemoryPhoto) {
    lightboxPhoto.value = photo
    writePhotoParams(photo)
  }

  async function step(dir: 1 | -1) {
    const next = await flatStep(dir)
    if (next) {
      open(next)
    }
  }

  function close() {
    lightboxPhoto.value = null
    writePhotoParams(null)
  }

  /** jumps back to the newest photo; the slideshow loops through this */
  async function rewind() {
    for (const section of unref(sections)) {
      if (!section.count) {
        continue
      }
      if (section.photos === null) {
        await fillSection(section)
      }
      const first = section.photos?.[0]
      if (first) {
        if (first.id !== unref(lightboxPhoto)?.id) {
          open(first)
        }
        return
      }
    }
  }

  /** initial deep link: reopen the photo once its month is filled */
  function restore() {
    const photoId = queryItemAsString(unref(photoQuery)) ?? ''
    if (!photoId) {
      return
    }
    const pos = locate(photoId)
    if (pos) {
      lightboxPhoto.value = unref(sections)[pos.sectionIdx].photos![pos.photoIdx]
    }
  }

  return { lightboxPhoto, hasPrev, hasNext, preload, open, step, close, restore, rewind }
}
