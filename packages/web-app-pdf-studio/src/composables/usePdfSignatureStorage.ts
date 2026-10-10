import { computed, nextTick, shallowRef, unref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { getUuid, SignatureExtractor } from 'pdfjs-dist'

// Same as the PDF.js viewer: in the browser's local storage, up to five.
const STORAGE_KEY = 'pdfjs.signature'
export const MAX_SIGNATURES = 5

type StoredSignature = { description: string; signatureData: string }

/** The lines of a signature, as PDF.js' signature editor takes them. */
type SignatureLines = {
  curves: { points: Float32Array | number[] }[]
  thickness: number
  width: number
  height: number
}

export type SavedSignature = {
  uuid: string
  description: string
  lines: SignatureLines
  /** Extracted from an image or text, drawn otherwise. */
  areContours: boolean
}

/** What PDF.js' signature editor returns for a new signature. */
export type NewSignatureData = {
  newCurves: (Float32Array | number[])[]
  areContours: boolean
  thickness: number
  width: number
  height: number
}

/** Signatures saved for reuse, like in the PDF.js viewer (see its SignatureStorage). */
export function usePdfSignatureStorage() {
  // Changes in other tabs come in as well. Writing fails e.g. when the storage is full.
  let hasWriteFailed = false
  const stored = useLocalStorage<Record<string, StoredSignature>>(
    STORAGE_KEY,
    {},
    {
      onError: (error) => {
        hasWriteFailed = true
        console.error(error)
      }
    }
  )
  const signatures = shallowRef<SavedSignature[]>([])

  watch(
    stored,
    async (entries) => {
      const list = await Promise.all(
        // Other apps of the same origin may have stored anything there.
        Object.entries(entries ?? {}).map(async ([uuid, entry]) => {
          if (typeof entry?.signatureData !== 'string') {
            return null
          }
          const { description, signatureData } = entry
          const data = await SignatureExtractor.decompressSignature(signatureData)
          if (!data) {
            return null
          }
          const { outlines, areContours, thickness, width, height } = data
          return {
            uuid,
            description,
            areContours,
            lines: { curves: outlines.map((points) => ({ points })), thickness, width, height }
          }
        })
      )
      if (entries === unref(stored)) {
        signatures.value = list.filter(Boolean)
      }
    },
    { immediate: true }
  )

  const isFull = computed(() => unref(signatures).length >= MAX_SIGNATURES)

  /** Returns the uuid of the saved signature, null if there's no room. */
  async function save(
    { newCurves, areContours, thickness, width, height }: NewSignatureData,
    description: string
  ) {
    if (unref(isFull)) {
      return null
    }
    const signatureData = await SignatureExtractor.compressSignature({
      outlines: newCurves,
      areContours,
      thickness,
      width,
      height
    })
    const uuid = getUuid()
    const previous = unref(stored)
    hasWriteFailed = false
    stored.value = { ...previous, [uuid]: { description, signatureData } }
    // Written to the storage before the next render.
    await nextTick()
    if (hasWriteFailed) {
      stored.value = previous
      return null
    }
    return uuid
  }

  function remove(uuid: string) {
    stored.value = Object.fromEntries(Object.entries(unref(stored)).filter(([key]) => key !== uuid))
  }

  return { signatures, isFull, save, remove }
}
