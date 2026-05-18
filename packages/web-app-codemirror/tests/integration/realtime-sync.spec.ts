// Integration test: two Yjs/Hocuspocus clients sync over the dev realtime route.
// Requires the docker-compose stack to be running (OC + Traefik + hocuspocus).
// Default realtime URL: wss://host.docker.internal:9200/realtime
//
// Run: pnpm vitest run tests/integration/realtime-sync.spec.ts

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import WS from 'ws'

const REALTIME_URL = process.env.REALTIME_URL ?? 'wss://host.docker.internal:9200/realtime'
const DEV_FAKE_TOKEN = process.env.DEV_FAKE_TOKEN ?? 'dev-integration-token'

beforeAll(() => {
  // dev cert is self-signed
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
})

interface Peer {
  doc: Y.Doc
  provider: HocuspocusProvider
}

function makePeer(
  documentName: string,
  token = DEV_FAKE_TOKEN,
  parameters: Record<string, string> = {}
): Peer {
  const doc = new Y.Doc()
  // HocuspocusProvider has no first-class `parameters` option; it just opens
  // a WebSocket against `url`. To get query params to the sidecar's
  // requestParameters, we append them to the URL ourselves.
  const qs = new URLSearchParams(parameters).toString()
  const url = qs ? `${REALTIME_URL}?${qs}` : REALTIME_URL
  const provider = new HocuspocusProvider({
    url,
    name: documentName,
    document: doc,
    token,
    // WebSocketPolyfill is missing from the TS type but accepted at runtime
    // (Node has no global WebSocket; this routes through ws)
    WebSocketPolyfill: WS,
    connect: true
  } as ConstructorParameters<typeof HocuspocusProvider>[0])
  return { doc, provider }
}

function awaitSynced(peer: Peer, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (peer.provider.isSynced) return resolve()
    const t = setTimeout(() => reject(new Error(`peer not synced within ${timeoutMs}ms`)), timeoutMs)
    peer.provider.on('synced', () => {
      clearTimeout(t)
      resolve()
    })
  })
}

function awaitText(doc: Y.Doc, expected: string, timeoutMs = 5000): Promise<string> {
  const yText = doc.getText('content')
  return new Promise((resolve, reject) => {
    if (yText.toString() === expected) return resolve(yText.toString())
    const t = setTimeout(
      () => reject(new Error(`text mismatch within ${timeoutMs}ms — got "${yText.toString()}", want "${expected}"`)),
      timeoutMs
    )
    const handler = () => {
      if (yText.toString() === expected) {
        yText.unobserve(handler)
        clearTimeout(t)
        resolve(yText.toString())
      }
    }
    yText.observe(handler)
  })
}

describe('realtime sync via Hocuspocus dev container', () => {
  let peers: Peer[] = []

  afterEach(() => {
    peers.forEach((p) => {
      p.provider.destroy()
      p.doc.destroy()
    })
    peers = []
  })

  it('replicates a Y.Text write from peer A to peer B', async () => {
    const docName = `test/sync-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const peerA = makePeer(docName)
    const peerB = makePeer(docName)
    peers.push(peerA, peerB)

    await Promise.all([awaitSynced(peerA), awaitSynced(peerB)])

    const message = 'hello from peer A'
    peerA.doc.getText('content').insert(0, message)

    const observed = await awaitText(peerB.doc, message)
    expect(observed).toBe(message)
  }, 15_000)

  it('converges concurrent edits across two peers (CRDT property)', async () => {
    const docName = `test/concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const peerA = makePeer(docName)
    const peerB = makePeer(docName)
    peers.push(peerA, peerB)

    await Promise.all([awaitSynced(peerA), awaitSynced(peerB)])

    // both peers prepend a token concurrently; one should win position 0
    peerA.doc.getText('content').insert(0, 'A')
    peerB.doc.getText('content').insert(0, 'B')

    // give the sync layer time to converge
    await new Promise<void>((resolve) => setTimeout(resolve, 1000))

    const a = peerA.doc.getText('content').toString()
    const b = peerB.doc.getText('content').toString()

    expect(a).toBe(b) // CRDT: both peers must agree
    expect(new Set(a.split(''))).toEqual(new Set(['A', 'B']))
  }, 15_000)

  it('stamps server-side identity on awareness even when client never sets one', async () => {
    const docName = `test/identity-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const peerA = makePeer(docName)
    const peerB = makePeer(docName)
    peers.push(peerA, peerB)

    await Promise.all([awaitSynced(peerA), awaitSynced(peerB)])

    // Peer A sets a non-user awareness field; never touches `user`.
    peerA.provider.awareness?.setLocalStateField('cursor', { line: 0, ch: 5 })

    // Peer B must see Peer A with a server-supplied `user` field.
    const seen = await new Promise<{ id: string; name: string; color: string } | 'timeout'>(
      (resolve) => {
        const t = setTimeout(() => resolve('timeout'), 4000)
        const aw = peerB.provider.awareness
        if (!aw) return resolve('timeout')
        const handler = () => {
          for (const state of aw.getStates().values()) {
            if (state?.user?.id) {
              clearTimeout(t)
              aw.off('update', handler)
              resolve(state.user)
              return
            }
          }
        }
        aw.on('update', handler)
        handler()
      }
    )

    expect(seen).not.toBe('timeout')
    expect((seen as { id: string }).id).toBe('dev-fake-user')
    expect((seen as { name: string }).name).toBe('Dev Fake User')
  }, 10_000)

  it('overwrites client-supplied awareness identity with the authenticated one', async () => {
    const docName = `test/spoof-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const attacker = makePeer(docName)
    const observer = makePeer(docName)
    peers.push(attacker, observer)

    await Promise.all([awaitSynced(attacker), awaitSynced(observer)])

    // Attacker tries to claim to be someone else. The server is supposed to
    // ignore client-supplied `user` entirely and stamp its own.
    attacker.provider.awareness?.setLocalStateField('user', {
      id: 'spoofed-id',
      name: 'Spoofed Admin',
      color: 'hsl(0, 100%, 50%)'
    })

    // Allow the server's onAwarenessUpdate rewrite to propagate; the spoofed
    // values may transit to the observer first, but the server-issued
    // correction must arrive within a short window.
    await new Promise<void>((resolve) => setTimeout(resolve, 800))

    const states = [...(observer.provider.awareness?.getStates().values() ?? [])]
    const userStates = states.filter((s) => s?.user).map((s) => s.user)
    expect(userStates.length).toBeGreaterThan(0)
    for (const u of userStates) {
      expect(u.id).toBe('dev-fake-user')
      expect(u.name).toBe('Dev Fake User')
      expect(u.name).not.toBe('Spoofed Admin')
    }
  }, 10_000)

  it('rejects connections with an invalid token', async () => {
    const docName = `test/auth-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const peer = makePeer(docName, 'definitely-not-a-valid-token')
    peers.push(peer)

    const failure = await new Promise<{ reason: string } | 'timeout'>((resolve) => {
      const t = setTimeout(() => resolve('timeout'), 4000)
      peer.provider.on('authenticationFailed', (data: unknown) => {
        clearTimeout(t)
        resolve(data as { reason: string })
      })
    })

    expect(failure).not.toBe('timeout')
    expect(peer.provider.isAuthenticated).toBe(false)
    expect(peer.provider.isSynced).toBe(false)
  }, 10_000)

  it('persists state across reconnects (Hocuspocus SQLite extension)', async () => {
    const docName = `test/persist-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const payload = 'persistent content'

    // first peer writes then disconnects
    const writer = makePeer(docName)
    await awaitSynced(writer)
    writer.doc.getText('content').insert(0, payload)
    // wait a beat so the server persists; Hocuspocus debounces writes
    await new Promise<void>((resolve) => setTimeout(resolve, 800))
    writer.provider.destroy()
    writer.doc.destroy()

    // second peer (fresh) joins; should receive the same content
    const reader = makePeer(docName)
    peers.push(reader)
    await awaitSynced(reader)

    expect(reader.doc.getText('content').toString()).toBe(payload)
  }, 15_000)

  it('marks doc stale when persisted etag mismatches the connecting peer\'s native etag', async () => {
    const docName = `test/stale-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // First peer arrives saying the native etag is X1, writes content, and
    // seeds `_oc_meta.etag = X1` so the persisted snapshot ties to X1.
    const writer = makePeer(docName, DEV_FAKE_TOKEN, { devEtag: 'X1' })
    await awaitSynced(writer)
    writer.doc.transact(() => {
      writer.doc.getText('content').insert(0, 'old content')
      writer.doc.getMap('_oc_meta').set('etag', 'X1')
    })
    // wait for Hocuspocus to debounce-persist
    await new Promise<void>((resolve) => setTimeout(resolve, 800))
    writer.provider.destroy()
    writer.doc.destroy()

    // Second peer arrives later and announces native etag X2 (external write
    // happened between sessions). Sidecar's onLoadDocument should flag the
    // doc as stale.
    const reader = makePeer(docName, DEV_FAKE_TOKEN, { devEtag: 'X2' })
    peers.push(reader)
    await awaitSynced(reader)

    // Give the staleness Y.Map update a moment to propagate to the reader.
    await new Promise<void>((resolve) => setTimeout(resolve, 200))

    expect(reader.doc.getMap('_oc_meta').get('isStale')).toBe(true)
    expect(reader.doc.getMap('_oc_meta').get('nativeEtag')).toBe('X2')
  }, 15_000)

  it('rejects a second peer with a different appVersion than the room baseline', async () => {
    const docName = `test/appver-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // First peer sets the baseline.
    const first = makePeer(docName, DEV_FAKE_TOKEN, { appVersion: 'v1' })
    peers.push(first)
    await awaitSynced(first)

    // Second peer with a different appVersion must be rejected at
    // authenticate-time. We listen for `authenticationFailed`.
    const second = makePeer(docName, DEV_FAKE_TOKEN, { appVersion: 'v2' })
    const failure = await new Promise<{ reason: string } | 'timeout'>((resolve) => {
      const t = setTimeout(() => resolve('timeout'), 4000)
      second.provider.on('authenticationFailed', (data: unknown) => {
        clearTimeout(t)
        resolve(data as { reason: string })
      })
    })
    second.provider.destroy()
    second.doc.destroy()

    expect(failure).not.toBe('timeout')
    // Hocuspocus normalizes server-thrown auth errors to a generic
    // 'permission-denied' reason; the human-readable message survives only
    // in sidecar logs.
    expect((failure as { reason: string }).reason).toBe('permission-denied')
    expect(second.provider.isAuthenticated).toBe(false)

    // A third peer with the matching baseline still gets in.
    const third = makePeer(docName, DEV_FAKE_TOKEN, { appVersion: 'v1' })
    peers.push(third)
    await awaitSynced(third)
    expect(third.provider.isAuthenticated).toBe(true)
  }, 15_000)
})
