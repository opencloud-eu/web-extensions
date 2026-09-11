import * as webPkg from '@opencloud-eu/web-pkg'
import type { Component, Ref } from 'vue'

// motion photo support ships with the web motion-photos branch; a shell built
// without it must not break the app, so these exports are feature-detected
// through the module namespace instead of named imports

interface MotionPlayback {
  isPlaying: Ref<boolean>
  isLoading: Ref<boolean>
  videoUrl: Ref<string | undefined>
  hoverPlay: () => void
  stop: () => void
  toggle: () => void
  seekToStill: (event: Event) => void
}

interface MotionApi {
  canPlay: (resource: unknown) => boolean
  loadVideoUrl: (space: unknown, resource: unknown, signal?: AbortSignal) => Promise<string>
}

const pkg = webPkg as Record<string, unknown>

export const hasMotionPhotoSupport =
  typeof pkg.useMotionPhoto === 'function' && typeof pkg.useMotionPhotoPlayback === 'function'

export const MotionPhotoBadge = pkg.MotionPhotoBadge as Component

export function useMotionPhoto(): MotionApi {
  return (pkg.useMotionPhoto as () => MotionApi)()
}

export function useMotionPhotoPlayback(resource: unknown, space: unknown): MotionPlayback {
  return (pkg.useMotionPhotoPlayback as (r: unknown, s: unknown) => MotionPlayback)(
    resource,
    space
  )
}
