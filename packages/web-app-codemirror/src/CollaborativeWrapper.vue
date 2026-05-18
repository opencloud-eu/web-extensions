<script setup lang="ts">
import { computed, ref, shallowRef, unref, watchEffect, type Component, type PropType } from 'vue'
import { storeToRefs } from 'pinia'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Resource } from '@opencloud-eu/web-client'
import { useAuthStore, useClientService, useConfigStore } from '@opencloud-eu/web-pkg'
import semverCompare from 'semver/functions/compare'
import semverValid from 'semver/functions/valid'
import type { CollaborativeAdapter } from './types'

const props = defineProps({
  resource: { type: Object as PropType<Resource>, required: true },
  currentContent: { type: String, required: true },
  isReadOnly: { type: Boolean, default: false },
  adapter: { type: Object as PropType<CollaborativeAdapter>, required: true },
  editor: { type: Object as PropType<Component>, required: true },
  // App version owned by the consuming app — typically `pkg.version` from
  // its own package.json, baked in at build time by Vite. Used to detect
  // schema mismatch between peers in the same Y.Doc room. The wrapper
  // itself stays agnostic of where the version comes from.
  appVersion: { type: String, required: true }
})

const META_KEY = '_oc_meta'
const SAVE_INTERVAL_MS = 60_000
const APP_VERSION = props.appVersion

// Semver comparison via the official `semver` package: handles pre-release
// ordering (`1.0.0-rc.1 < 1.0.0`), multi-digit segments (`0.20.0 > 0.3.0`),
// build metadata, etc. Returns negative when `a < b`, positive when `a > b`,
// zero on equal. Non-semver strings (e.g. raw git SHAs in dev builds) fall
// back to strict equality and produce `0` for equal / `NaN` otherwise; the
// callers treat `NaN` as "incomparable, force reload".
function compareVersion(a: string, b: string): number {
  if (semverValid(a) && semverValid(b)) return semverCompare(a, b)
  return a === b ? 0 : Number.NaN
}

const configStore = useConfigStore()
const { serverUrl } = storeToRefs(configStore)
const authStore = useAuthStore()
const clientService = useClientService()

const ydoc = shallowRef<Y.Doc | null>(null)
const provider = shallowRef<HocuspocusProvider | null>(null)
const status = shallowRef<'connecting' | 'connected' | 'disconnected'>('connecting')
const currentETag = ref<string>('')
const lastSaveError = shallowRef<Error | null>(null)
// Set when the sidecar told us the persisted state is stale and we either
// recovered locally or need the user to reload. Separate from
// `lastSaveError` to avoid confusing the save-conflict UI with a
// version/staleness surface.
const lifecycleError = shallowRef<Error | null>(null)
const isSaving = ref(false)
// True after we've forcibly disconnected because of an app-version mismatch.
// The editor stays mounted with the last-known content but flips read-only
// and the user is asked to reload.
const isLockedForReload = ref(false)
// Flips true whenever a Y.Doc update arrives whose `origin` isn't one of
// our own internal transactions (hydrate/reset/recovery/meta-seed). Reset
// after a successful save. Drives the save button's enabled state.
const hasUnsavedChanges = ref(false)
const isDirty = computed(() => unref(hasUnsavedChanges) && !effectiveReadOnly.value)
// Y.Doc transaction origins we generate ourselves and that should NOT
// count as user-driven dirty edits. Each named `doc.transact(..., origin)`
// must be listed here so it doesn't toggle the save button.
const INTERNAL_ORIGINS = new Set<string>([
  'hydrate',
  'reset',
  'stale-recovery-reset',
  'stale-recovery-commit'
])

const documentName = computed(() => {
  const r = props.resource as Resource & { remoteItemId?: string }
  // OC's canonical composite id `<storageid>$<spaceid>!<opaqueid>`. The
  // owner reads it from `r.id`, a share recipient reads the same composite
  // from `r.remoteItemId` (which points at the owner's drive+item). Both
  // peers end up with the same value, so it doubles as the Y.Doc match key
  // and the ACL probe target the sidecar passes to Graph.
  return r.remoteItemId ?? r.id
})

const realtimeBaseUrl = computed(() => {
  const base = unref(serverUrl).replace(/\/$/, '')
  return base.replace(/^http/, 'ws') + '/realtime'
})

const effectiveReadOnly = computed(() => props.isReadOnly || isLockedForReload.value)

// ---------------------------------------------------------------------------
// Provider lifecycle — rebuilt whenever the file identity changes.
// ---------------------------------------------------------------------------
watchEffect((onCleanup) => {
  const name = unref(documentName)
  const wsUrl = unref(realtimeBaseUrl)
  if (!name || !wsUrl) return

  // Reset per-file state.
  currentETag.value = ''
  lastSaveError.value = null
  lifecycleError.value = null
  isLockedForReload.value = false
  hasUnsavedChanges.value = false

  // HocuspocusProvider has no `parameters` option; we get query params to
  // the sidecar's requestParameters by appending them to the URL ourselves.
  const wsUrlWithParams = `${wsUrl}?appVersion=${encodeURIComponent(APP_VERSION)}`

  const doc = new Y.Doc()

  // Mark "dirty" on any Y.Doc update whose origin isn't one of our own
  // named internal transactions. Codemirror/Tiptap bindings issue
  // user-typing updates without a named origin (or with an editor-internal
  // origin object); both produce `origin !== INTERNAL_ORIGINS member`.
  const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
    if (typeof origin === 'string' && INTERNAL_ORIGINS.has(origin)) return
    hasUnsavedChanges.value = true
  }
  doc.on('update', onDocUpdate)

  const prov = new HocuspocusProvider({
    url: wsUrlWithParams,
    name,
    document: doc,
    token: () => authStore.accessToken,
    onStatus({ status: s }) {
      status.value = s as typeof status.value
    },
    onAuthenticationFailed({ reason }) {
      console.error('[collab] realtime auth failed:', reason)
      // Surface as lifecycle error so the user sees the reason rather than a
      // silent disconnect. Server uses this for app-version rejection too.
      lifecycleError.value = new Error(reason || 'authentication failed')
      isLockedForReload.value = true
    },
    onSynced() {
      void onProviderSynced(doc, prov)
    }
  })

  // Empty-user bootstrap: creates an awareness entry under our Y.Doc.clientID
  // as soon as the provider connects, so peers see us before the editor
  // binding emits its first cursor update. The server's beforeHandleAwareness
  // hook overwrites this with the authenticated identity. Lurkers that never
  // touch `user` stay invisible (matches the hook's "only stamp when present"
  // rule).
  prov.setAwarenessField('user', {})

  // _oc_meta is the parallel channel for save/etag/lifecycle coordination.
  // The editor binding never sees it because adapters bind to their own
  // shared types (e.g. Y.Text 'content' for CodeMirror).
  const meta = doc.getMap(META_KEY)
  const metaObserver = (event: Y.YMapEvent<unknown>) => {
    const tag = meta.get('etag') as string | undefined
    if (tag && tag !== currentETag.value) currentETag.value = tag

    // App version mismatch surfaced after-the-fact (e.g. a newer peer joined
    // and bumped `appVersion`). Any non-zero diff at this point means the
    // room moved past or ahead of us mid-session — lock and prompt reload.
    // Stale-recovery is intentionally NOT triggered here; that path only
    // applies when the doc state itself was already older than the current
    // client at first load.
    if (event.keysChanged.has('appVersion')) {
      const docVersion = meta.get('appVersion') as string | undefined
      if (docVersion) {
        const cmp = compareVersion(APP_VERSION, docVersion)
        if (Number.isNaN(cmp) || cmp !== 0) {
          lockForReload(
            prov,
            `This file is now being edited with app version ${docVersion} ` +
              `(yours is ${APP_VERSION}). Please reload.`
          )
        }
      }
    }

    // Stale-state signal from the sidecar's onLoadDocument: the persisted
    // Y.Doc was tied to an etag that no longer matches the native file. We
    // run a client-side rehydrate (election prevents all peers from doing
    // it at once).
    if (event.keysChanged.has('isStale') && meta.get('isStale') === true) {
      void recoverFromStaleState(doc, prov)
    }
  }
  meta.observe(metaObserver)

  // Periodic auto-save.
  const saveTimer = window.setInterval(() => {
    void saveToNative(doc)
  }, SAVE_INTERVAL_MS)

  // Final save on tab close. Best-effort — long ops may be cut off.
  const beforeUnload = () => {
    void saveToNative(doc)
  }
  window.addEventListener('beforeunload', beforeUnload)

  ydoc.value = doc
  provider.value = prov

  onCleanup(() => {
    window.removeEventListener('beforeunload', beforeUnload)
    window.clearInterval(saveTimer)
    meta.unobserve(metaObserver)
    doc.off('update', onDocUpdate)
    prov.destroy()
    doc.destroy()
    if (provider.value === prov) provider.value = null
    if (ydoc.value === doc) ydoc.value = null
  })
})

function lockForReload(prov: HocuspocusProvider, message: string) {
  if (isLockedForReload.value) return
  isLockedForReload.value = true
  lifecycleError.value = new Error(message)
  try {
    prov.disconnect()
  } catch {
    // disconnect can throw if already torn down; ignore.
  }
}

// ---------------------------------------------------------------------------
// Hydration — elected client seeds Y.Doc from native content. Lowest
// awareness clientId wins to avoid double-hydration when two peers see an
// empty doc simultaneously.
// ---------------------------------------------------------------------------
async function onProviderSynced(doc: Y.Doc, prov: HocuspocusProvider) {
  const meta = doc.getMap(META_KEY)

  // If the sidecar already flagged the doc as stale (etag or app-version
  // drift between persisted state and this connect), let the meta-observer
  // fire `recoverFromStaleState`. Skip the version check below so we don't
  // race-lock the user out of a doc we're about to rehydrate cleanly.
  if (meta.get('isStale') === true) return

  // App-version handshake.
  // - empty: first client into the room, seed our version
  // - equal: no-op
  // - doc is OLDER than us: persisted state pre-dates our schema; treat
  //   as stale and trigger the recovery flow (sidecar usually flags this
  //   in onLoadDocument; this branch is the fallback)
  // - doc is NEWER than us OR incomparable: we are out of date, force
  //   reload — the user must refresh to a current bundle
  const docVersion = meta.get('appVersion') as string | undefined
  if (!docVersion) {
    doc.transact(() => {
      if (!meta.get('appVersion')) meta.set('appVersion', APP_VERSION)
    })
  } else {
    const cmp = compareVersion(APP_VERSION, docVersion)
    if (Number.isNaN(cmp) || cmp < 0) {
      lockForReload(
        prov,
        `This file is being edited with app version ${docVersion} ` +
          `(yours is ${APP_VERSION}). Please reload.`
      )
      return
    }
    if (cmp > 0) {
      doc.transact(() => meta.set('isStale', true))
      return
    }
  }

  // Seed the etag immediately so save attempts have a baseline.
  if (!meta.get('etag') && props.resource.etag) {
    doc.transact(() => {
      if (!meta.get('etag')) meta.set('etag', props.resource.etag)
    })
  }

  if (props.adapter.hasContent(doc)) return
  if (effectiveReadOnly.value) return // never seed from a read-only view

  // Let other clients announce themselves via awareness before electing.
  await new Promise<void>((resolve) => setTimeout(resolve, 150))

  if (props.adapter.hasContent(doc)) return // someone beat us

  const myId = doc.clientID
  const peers = Array.from(prov.awareness?.getStates().keys() ?? [])
  const lowest = peers.length ? Math.min(myId, ...peers) : myId
  if (myId !== lowest) return

  await Promise.resolve(props.adapter.hydrate(doc, props.currentContent))
}

// ---------------------------------------------------------------------------
// Stale-state recovery — fired when the sidecar flags `_oc_meta.isStale`
// because the persisted Y.Doc's etag no longer matches the native file. The
// elected client wipes adapter content, clears the staleness flag, and
// re-hydrates from `props.currentContent` (which the parent route component
// re-fetched at app-open time, so it reflects the new native content).
// Other peers see the wipe + hydrate as ordinary CRDT updates.
// ---------------------------------------------------------------------------
async function recoverFromStaleState(doc: Y.Doc, prov: HocuspocusProvider) {
  const meta = doc.getMap(META_KEY)
  if (effectiveReadOnly.value) return
  if (typeof props.adapter.reset !== 'function') {
    lockForReload(
      prov,
      'This file was changed externally and your editor cannot recover in-place. Please reload.'
    )
    return
  }

  // Election: lowest awareness clientId wins, same primitive as initial
  // hydrate. Peers without a reset-capable adapter never elect themselves.
  await new Promise<void>((resolve) => setTimeout(resolve, 150))
  if (meta.get('isStale') !== true) return // someone else handled it

  const myId = doc.clientID
  const peers = Array.from(prov.awareness?.getStates().keys() ?? [])
  const lowest = peers.length ? Math.min(myId, ...peers) : myId
  if (myId !== lowest) return

  const freshEtag = (meta.get('nativeEtag') as string | undefined) ?? props.resource.etag ?? ''

  // Split into three phases so a crash between reset and hydrate leaves
  // `isStale` set: the next peer entering the room then re-runs recovery
  // instead of inheriting an empty doc with cleared flags.
  doc.transact(() => {
    props.adapter.reset?.(doc)
  }, 'stale-recovery-reset')

  await Promise.resolve(props.adapter.hydrate(doc, props.currentContent))

  doc.transact(() => {
    meta.delete('isStale')
    meta.delete('nativeEtag')
    if (freshEtag) meta.set('etag', freshEtag)
    // Bump the version stamp too: the prior persisted state may have been
    // tied to an older `appVersion`, and the recovered content is now in
    // our current layout. Late joiners with the same version pass the
    // handshake; older clients still bounce on their own version check.
    meta.set('appVersion', APP_VERSION)
  }, 'stale-recovery-commit')
}

// ---------------------------------------------------------------------------
// Save loop — adapter-agnostic. The wrapper only knows: serialize + PUT.
// 412 → HEAD probe; if remote etag differs from ours, it's a real external
// conflict (sync client or out-of-band write). Otherwise an internal race
// (another collab peer saved milliseconds before us) — we just refresh and
// the next interval picks up.
// ---------------------------------------------------------------------------
async function saveToNative(doc: Y.Doc) {
  if (effectiveReadOnly.value) return
  if (isSaving.value) return
  if (!doc || doc.isDestroyed) return
  if (!props.adapter.hasContent(doc)) return

  isSaving.value = true
  try {
    const content = await Promise.resolve(props.adapter.serialize(doc))
    const meta = doc.getMap(META_KEY)
    const previousEntityTag = (meta.get('etag') as string) || unref(currentETag)

    try {
      const updated = await clientService.webdav.putFileContents(props.resource, {
        content,
        previousEntityTag
      })
      doc.transact(() => {
        meta.set('etag', updated.etag)
        meta.set('lastSavedAt', Date.now())
      })
      hasUnsavedChanges.value = false
      lastSaveError.value = null
    } catch (e: any) {
      if (e?.statusCode === 412) {
        const remote = await clientService.webdav.getFileInfo(props.resource)
        if (remote.etag && remote.etag !== previousEntityTag) {
          // Real external conflict.
          doc.transact(() => meta.set('etag', remote.etag))
          lastSaveError.value = new Error(
            'This file was changed outside the collaborative session.'
          )
        }
        // else: internal race; next interval will retry naturally.
      } else {
        lastSaveError.value = e instanceof Error ? e : new Error(String(e))
      }
    }
  } finally {
    isSaving.value = false
  }
}

function saveNowFromButton() {
  const doc = unref(ydoc)
  if (doc) void saveToNative(doc)
}

defineExpose({ saveNow: saveNowFromButton })
</script>

<template>
  <div class="oc-width-1-1 oc-height-1-1 oc-flex oc-flex-column">
    <div class="oc-p-s oc-text-meta oc-flex oc-flex-middle">
      <span>{{ documentName }}</span>
      <span class="oc-ml-m">— {{ status }}</span>
      <span v-if="currentETag" class="oc-ml-m">etag: {{ currentETag.slice(0, 8) }}</span>
      <span v-if="isDirty" class="oc-ml-m">— unsaved changes</span>
      <span v-if="isSaving" class="oc-ml-m">— saving…</span>
      <span v-if="lastSaveError" class="oc-ml-m oc-text-danger">— {{ lastSaveError.message }}</span>
      <span v-if="lifecycleError" class="oc-ml-m oc-text-danger">— {{ lifecycleError.message }}</span>
      <span v-if="effectiveReadOnly" class="oc-ml-m">(read-only)</span>
      <!-- Explicit save button. OC's AppWrapper save mechanism would need an
           etag-from-collab refresh path we don't have, so we render our own
           button here for PoC. To move into OC's chrome later, the wrapper
           needs to replace AppWrapperRoute. -->
      <button
        data-testid="collab-save"
        class="oc-ml-auto oc-button"
        :disabled="!isDirty || isSaving || effectiveReadOnly"
        @click="saveNowFromButton"
      >
        Save
      </button>
    </div>
    <component
      :is="editor"
      v-if="ydoc && provider?.awareness"
      :ydoc="ydoc"
      :awareness="provider.awareness"
      :is-read-only="effectiveReadOnly"
      class="oc-width-1-1 oc-flex-1"
    />
  </div>
</template>
