<script setup lang="ts">
import {
  computed,
  ref,
  shallowRef,
  unref,
  watch,
  watchEffect,
  type Component,
  type PropType
} from 'vue'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Resource } from '@opencloud-eu/web-client'
import { useAuthStore, useConfigStore } from '@opencloud-eu/web-pkg'
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

// The hosting AppWrapper drives isEditor / isDirty / autoSave / Ctrl+S /
// the unsaved-changes modal off `update:currentContent` emissions. We push
// the latest serialized form of the Y.Doc into it after each user edit; the
// AppWrapper's save path then PUTs that string with its own etag tracking.
const emit = defineEmits<{
  (e: 'update:currentContent', value: string): void
}>()

const META_KEY = '_oc_meta'
const SERIALIZE_DEBOUNCE_MS = 300
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
const authStore = useAuthStore()

const ydoc = shallowRef<Y.Doc | null>(null)
const provider = shallowRef<HocuspocusProvider | null>(null)
const status = shallowRef<'connecting' | 'connected' | 'disconnected'>('connecting')
// Set when the sidecar told us the persisted state is stale and we either
// recovered locally or need the user to reload, or when realtime auth failed.
const lifecycleError = shallowRef<Error | null>(null)
// True after we've forcibly disconnected because of an app-version mismatch.
// The editor stays mounted with the last-known content but flips read-only
// and the user is asked to reload.
const isLockedForReload = ref(false)
// Y.Doc transaction origins we generate ourselves and that should NOT
// produce an `update:currentContent` emission — hydrate/reset/recovery just
// reshape the local CRDT after the parent's `currentContent` was loaded;
// re-emitting the same content right back would only burn cycles and, in
// the recovery case, racily flip AppWrapper's `isDirty` between recover
// and the next real edit.
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
  const base = configStore.serverUrl.replace(/\/$/, '')
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
  lifecycleError.value = null
  isLockedForReload.value = false

  // HocuspocusProvider has no `parameters` option; we get query params to
  // the sidecar's requestParameters by appending them to the URL ourselves.
  const wsUrlWithParams = `${wsUrl}?appVersion=${encodeURIComponent(APP_VERSION)}`

  const doc = new Y.Doc()

  // Debounced serialize → emit. We hand AppWrapper the same string an
  // out-of-band PUT would write; AppWrapper diffs it against its
  // serverContent to derive isDirty. Internal-origin transactions
  // (hydrate / reset / stale-recovery) are skipped to avoid round-tripping
  // the parent's freshly-loaded content back to it as a fake user edit.
  let serializeTimer: number | undefined
  const scheduleEmit = () => {
    if (serializeTimer !== undefined) window.clearTimeout(serializeTimer)
    serializeTimer = window.setTimeout(() => {
      serializeTimer = undefined
      if (doc.isDestroyed) return
      if (!props.adapter.hasContent(doc)) return
      try {
        const serialized = props.adapter.serialize(doc)
        if (typeof serialized === 'string') {
          emit('update:currentContent', serialized)
          return
        }
        // Adapter returned a Promise (e.g. tiptap headless editor).
        void Promise.resolve(serialized).then((value) => {
          if (doc.isDestroyed) return
          emit('update:currentContent', value)
        })
      } catch (e) {
        console.error('[collab] serialize for emit failed:', e)
      }
    }, SERIALIZE_DEBOUNCE_MS)
  }

  const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
    if (typeof origin === 'string' && INTERNAL_ORIGINS.has(origin)) return
    scheduleEmit()
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

  // _oc_meta is the parallel channel for stale/version coordination. The
  // editor binding never sees it because adapters bind to their own shared
  // types (e.g. Y.Text 'content' for CodeMirror).
  const meta = doc.getMap(META_KEY)
  const metaObserver = (event: Y.YMapEvent<unknown>) => {
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

  ydoc.value = doc
  provider.value = prov

  onCleanup(() => {
    if (serializeTimer !== undefined) window.clearTimeout(serializeTimer)
    meta.unobserve(metaObserver)
    doc.off('update', onDocUpdate)
    prov.destroy()
    doc.destroy()
    if (provider.value === prov) provider.value = null
    if (ydoc.value === doc) ydoc.value = null
  })
})

// AppWrapper updates `props.resource` after each of its own saves via
// `resourcesStore.upsertResource(putFileContentsResponse)`, which bubbles
// the new etag back into this prop. Mirror it into `_oc_meta.etag` so the
// sidecar's stale-state probe (on the next room load after eviction) and
// any future peer-aware logic see the current authoritative tag.
watch(
  () => props.resource.etag,
  (newEtag) => {
    const doc = unref(ydoc)
    if (!doc || doc.isDestroyed || !newEtag) return
    const meta = doc.getMap(META_KEY)
    if (meta.get('etag') === newEtag) return
    doc.transact(() => {
      meta.set('etag', newEtag)
      meta.set('lastSavedAt', Date.now())
    })
  }
)

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

  // Seed the etag immediately so future stale-state probes have a baseline.
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
</script>

<template>
  <div class="oc-width-1-1 oc-height-1-1 oc-flex oc-flex-column">
    <!-- Compact status strip — connection state + lifecycle errors only.
         Save / dirty / etag UX is owned by the hosting AppWrapper. -->
    <div class="oc-p-s oc-text-meta oc-flex oc-flex-middle">
      <span>— {{ status }}</span>
      <span v-if="lifecycleError" class="oc-ml-m oc-text-danger">— {{ lifecycleError.message }}</span>
      <span v-if="effectiveReadOnly" class="oc-ml-m">(read-only)</span>
    </div>
    <component
      :is="editor"
      v-if="ydoc && provider?.awareness"
      :ydoc="ydoc"
      :awareness="provider.awareness"
      :provider="provider"
      :is-read-only="effectiveReadOnly"
      class="oc-width-1-1 oc-flex-1"
    />
  </div>
</template>
