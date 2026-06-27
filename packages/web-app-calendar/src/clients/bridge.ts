// Client for oc-calendar-bridge, the companion backend that fetches external
// calendar subscriptions server-side (browsers can't, due to CORS) and serves
// public ICS feeds for calendars the user publishes. Reached same-origin through
// the OpenCloud proxy at /calendar-bridge/ (protected; the proxy injects the
// caller identity), so the logged-in session carries the auth automatically.
import { ref } from 'vue'

// Same-origin prefix the OpenCloud proxy forwards to oc-calendar-bridge (the
// protected route that injects X-Remote-User). Defaults to /calendar-bridge but
// can be overridden via the app's config.json (bridgeBase) to match the proxy.
export let BRIDGE_BASE = '/calendar-bridge'
export const setBridgeBase = (v?: string): void => {
  if (v && v.trim()) {
    BRIDGE_BASE = v.replace(/\/$/, '')
  }
}

// Whether the companion bridge is available. The subscription and public
// sharing features depend on it; when no bridge is deployed, set "bridge": false
// in the app's config.json and the related UI is hidden so the app stays clean
// running against CalDAV (Radicale) alone.
export const bridgeEnabled = ref(true)
export const setBridgeEnabled = (v: boolean): void => {
  bridgeEnabled.value = v
}

export interface Subscription {
  id: string
  url: string
  name: string
  color: string
  created: string
  lastFetch: string
  lastError: string
  eventCount: number
}

export interface Publication {
  id: string
  name: string
  collection: string
  busyOnly: boolean
  feedPath: string
}

// Minimal shape of the authenticated axios instance from useClientService().
export interface HttpClient {
  get(url: string, config?: unknown): Promise<{ data: unknown }>
  post(url: string, data?: unknown, config?: unknown): Promise<{ data: unknown }>
  delete(url: string, config?: unknown): Promise<{ data: unknown }>
}

export class BridgeClient {
  constructor(private http: HttpClient) {}

  async listSubscriptions(): Promise<Subscription[]> {
    const res = await this.http.get(`${BRIDGE_BASE}/subscriptions`)
    return (res.data as Subscription[]) || []
  }

  async addSubscription(url: string, name: string, color: string): Promise<Subscription> {
    const res = await this.http.post(`${BRIDGE_BASE}/subscriptions`, { url, name, color })
    return res.data as Subscription
  }

  async removeSubscription(id: string): Promise<void> {
    await this.http.delete(`${BRIDGE_BASE}/subscriptions/${encodeURIComponent(id)}`)
  }

  async refreshSubscription(id: string): Promise<Subscription> {
    const res = await this.http.post(
      `${BRIDGE_BASE}/subscriptions/${encodeURIComponent(id)}/refresh`
    )
    return res.data as Subscription
  }

  // Same-origin URL of a subscription's cached ICS (the views fetch + parse it).
  icsUrl(id: string): string {
    return `${BRIDGE_BASE}/subscriptions/${encodeURIComponent(id)}/ics`
  }

  async getICS(id: string): Promise<string> {
    const res = await this.http.get(this.icsUrl(id), { responseType: 'text' })
    return res.data as string
  }

  async listPublications(): Promise<Publication[]> {
    const res = await this.http.get(`${BRIDGE_BASE}/publications`)
    return (res.data as Publication[]) || []
  }

  async publish(collection: string, name: string, busyOnly: boolean): Promise<Publication> {
    const res = await this.http.post(`${BRIDGE_BASE}/publish`, { collection, name, busyOnly })
    return res.data as Publication
  }

  async unpublish(id: string): Promise<void> {
    await this.http.delete(`${BRIDGE_BASE}/publications/${encodeURIComponent(id)}`)
  }
}
