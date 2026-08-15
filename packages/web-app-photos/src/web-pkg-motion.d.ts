import type { DefineComponent } from 'vue'

/**
 * Motion photo exports that ship with the web consolidation branch; the
 * published web-pkg types do not include them yet. Loose on purpose, the
 * runtime instance comes from the shell via module federation.
 */
declare module '@opencloud-eu/web-pkg' {
  export const MotionPhotoBadge: DefineComponent<{
    playing?: boolean
    loading?: boolean
    interactive?: boolean
    showTooltip?: boolean
  }>

  export function useMotionPhoto(): {
    isMotionPhoto: (resource: unknown) => boolean
    canPlay: (resource: unknown) => boolean
    getStillTimestampSeconds: (resource: unknown) => number | null
    loadVideoUrl: (space: unknown, resource: unknown, signal?: AbortSignal) => Promise<string>
  }
}
