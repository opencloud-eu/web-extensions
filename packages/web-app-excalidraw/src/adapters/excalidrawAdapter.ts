import * as Y from 'yjs'
import { yjsToExcalidraw } from 'y-excalidraw'
import { generateKeyBetween } from 'fractional-indexing'
import type { YjsAdapter } from '@opencloud-eu/web-pkg'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'

// Y.Array/Y.Map shapes that match what `y-excalidraw`'s ExcalidrawBinding
// reads and writes. Each Y.Map in the elements array carries:
//   { el: ExcalidrawElement, pos: string (fractional-indexing key) }
// Assets is a flat Y.Map keyed by file id with BinaryFileData values.
const ELEMENTS_KEY = 'elements'
const ASSETS_KEY = 'assets'
/**
 * Our own corner of the document. `initialized` marks that hydration ran, which is what tells
 * an empty board apart from one that was never seeded - without it the wrapper would skip
 * serialization for a board the user just emptied, and the deletion would never reach the file.
 * `appState` keeps the document level scene settings.
 */
const META_KEY = '_oc_excalidraw'
const INITIALIZED_KEY = 'initialized'
const APP_STATE_KEY = 'appState'
const APP_STATE_ORIGIN = 'appState'

interface ExcalidrawWireFormat {
  type?: string
  version?: number
  source?: string
  elements?: ExcalidrawElement[]
  appState?: Record<string, unknown>
  files?: BinaryFiles
}

const APP_NAME = 'opencloud-excalidraw'

/**
 * The slice of Excalidraw's appState that belongs to the document rather than to the viewer.
 * Everything else in there - scroll position, zoom, selection, the active tool - is per client
 * and must never be shared, so we carry exactly these two.
 */
const SCENE_SETTING_KEYS = ['viewBackgroundColor', 'gridSize'] as const
/** Used for a file that carries no scene settings of its own. */
const APP_STATE_DEFAULTS: SceneSettings = {
  viewBackgroundColor: '#ffffff',
  gridSize: null
}

export type SceneSettings = {
  viewBackgroundColor: unknown
  gridSize: unknown
}

function pickSceneSettings(appState: Record<string, unknown> | undefined): SceneSettings {
  const picked = { ...APP_STATE_DEFAULTS }
  if (!appState) return picked
  for (const key of SCENE_SETTING_KEYS) {
    if (appState[key] !== undefined) picked[key] = appState[key]
  }
  return picked
}

/** The document level scene settings of the currently open file. */
export function readAppState(ydoc: Y.Doc): SceneSettings {
  const stored = ydoc.getMap(META_KEY).get(APP_STATE_KEY)
  return stored && typeof stored === 'object'
    ? { ...APP_STATE_DEFAULTS, ...(stored as SceneSettings) }
    : { ...APP_STATE_DEFAULTS }
}

/**
 * Call `onRemoteChange` whenever another client changed the scene settings. Returns the
 * unsubscribe function.
 */
export function observeAppState(ydoc: Y.Doc, onRemoteChange: (next: SceneSettings) => void) {
  const handler = (_event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
    if (transaction.local) return
    onRemoteChange(readAppState(ydoc))
  }
  const yMeta = ydoc.getMap(META_KEY)
  yMeta.observe(handler)
  return () => yMeta.unobserve(handler)
}

/**
 * Share a scene setting change the local user made. A no-op when nothing the document cares
 * about changed, which is most of the time: Excalidraw's onChange fires on every pointer move.
 */
export function writeAppState(ydoc: Y.Doc, appState: Record<string, unknown>) {
  const next = pickSceneSettings(appState)
  const current = readAppState(ydoc)
  if (SCENE_SETTING_KEYS.every((key) => next[key] === current[key])) return
  ydoc.transact(() => ydoc.getMap(META_KEY).set(APP_STATE_KEY, next), APP_STATE_ORIGIN)
}

/**
 * Seed the Y.Array with elements from a parsed .excalidraw payload.
 * We assign each element a fractional-indexing position so later inserts
 * between two existing elements can land at a stable spot without
 * renumbering. y-excalidraw's helpers expect this exact shape.
 */
function seedElements(yElements: Y.Array<Y.Map<unknown>>, elements: ExcalidrawElement[]) {
  let prevKey: string | null = null
  for (const el of elements) {
    const pos = generateKeyBetween(prevKey, null)
    const yEl = new Y.Map<unknown>()
    yEl.set('el', el)
    yEl.set('pos', pos)
    yElements.push([yEl])
    prevKey = pos
  }
}

const excalidrawAdapter: YjsAdapter = {
  hydrate(ydoc, content) {
    let parsed: ExcalidrawWireFormat = {}
    if (content && content.trim()) {
      try {
        parsed = JSON.parse(content) as ExcalidrawWireFormat
      } catch (e) {
        // Refuse the file rather than opening a blank canvas: the user would draw on it and
        // the next save would silently overwrite whatever was in there. AppWrapper turns a
        // throwing hydration into a locked editor with an error.
        throw new Error(`"${content.slice(0, 32)}..." is not a valid Excalidraw file`, { cause: e })
      }
    }

    const yElements = ydoc.getArray<Y.Map<unknown>>(ELEMENTS_KEY)
    const yAssets = ydoc.getMap(ASSETS_KEY)
    const yMeta = ydoc.getMap(META_KEY)
    // The wrapper's election only lets one client hydrate, so this re-entry
    // guard is more belt-and-braces than load-bearing.
    if (yMeta.get(INITIALIZED_KEY)) return
    ydoc.transact(() => {
      if (parsed.elements?.length) {
        seedElements(yElements, parsed.elements)
      }
      if (parsed.files) {
        for (const [id, file] of Object.entries(parsed.files)) {
          yAssets.set(id, file)
        }
      }
      yMeta.set(APP_STATE_KEY, pickSceneSettings(parsed.appState))
      yMeta.set(INITIALIZED_KEY, true)
    }, 'hydrate')
  },

  serialize(ydoc) {
    const yElements = ydoc.getArray<Y.Map<unknown>>(ELEMENTS_KEY)
    const yAssets = ydoc.getMap(ASSETS_KEY)
    const elements = yjsToExcalidraw(yElements)
    const files: BinaryFiles = {}
    for (const key of yAssets.keys()) {
      files[key] = yAssets.get(key) as BinaryFiles[string]
    }
    const payload: ExcalidrawWireFormat = {
      type: 'excalidraw',
      version: 2,
      source: APP_NAME,
      elements,
      appState: readAppState(ydoc),
      files
    }
    return JSON.stringify(payload)
  },

  hasContent(ydoc) {
    // Deliberately not "are there elements": a board the user emptied still has content in the
    // sense that matters here, namely a state worth writing back to the file.
    return ydoc.getMap(META_KEY).get(INITIALIZED_KEY) === true
  },

  reset(ydoc) {
    const yElements = ydoc.getArray<Y.Map<unknown>>(ELEMENTS_KEY)
    const yAssets = ydoc.getMap(ASSETS_KEY)
    const yMeta = ydoc.getMap(META_KEY)
    if (yElements.length === 0 && yAssets.size === 0 && yMeta.size === 0) return
    ydoc.transact(() => {
      yElements.delete(0, yElements.length)
      for (const key of Array.from(yAssets.keys())) yAssets.delete(key)
      for (const key of Array.from(yMeta.keys())) yMeta.delete(key)
    }, 'reset')
  }
}

/**
 * Handed to AppWrapper via the route's `yjs` option. The adapter is stateless,
 * so the resource from the context is not needed here.
 */
export function makeExcalidrawAdapter(): YjsAdapter {
  return excalidrawAdapter
}
