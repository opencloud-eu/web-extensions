import { ref } from 'vue'
import { useClientService } from '@opencloud-eu/web-pkg'
import {
  BridgeClient,
  type HttpClient,
  type Subscription,
  type Publication
} from '../clients/bridge'

// Module-scoped so every view shares one list of subscriptions/publications and
// the per-subscription visibility state.
const subscriptions = ref<Subscription[]>([])
const publications = ref<Publication[]>([])
const loaded = ref(false)

const VIS_KEY = 'oc-calendar-subs-hidden'
const hidden = ref<Set<string>>(loadHidden())

function loadHidden(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VIS_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
function persistHidden() {
  localStorage.setItem(VIS_KEY, JSON.stringify([...hidden.value]))
}

export const useBridge = () => {
  const clientService = useClientService()
  const client = new BridgeClient(clientService.httpAuthenticated as unknown as HttpClient)

  const ensureLoaded = async (force = false): Promise<void> => {
    if (loaded.value && !force) {
      return
    }
    subscriptions.value = await client.listSubscriptions()
    loaded.value = true
  }

  const refreshSubscriptions = async (): Promise<void> => {
    subscriptions.value = await client.listSubscriptions()
  }

  const addSubscription = async (
    url: string,
    name: string,
    color: string
  ): Promise<Subscription> => {
    const sub = await client.addSubscription(url, name, color)
    await refreshSubscriptions()
    return sub
  }

  const removeSubscription = async (id: string): Promise<void> => {
    await client.removeSubscription(id)
    const next = new Set(hidden.value)
    next.delete(id)
    hidden.value = next
    persistHidden()
    await refreshSubscriptions()
  }

  const refreshOne = async (id: string): Promise<void> => {
    await client.refreshSubscription(id)
    await refreshSubscriptions()
  }

  const isVisible = (id: string): boolean => !hidden.value.has(id)
  const toggleVisible = (id: string): void => {
    const next = new Set(hidden.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    hidden.value = next
    persistHidden()
  }

  const loadPublications = async (): Promise<void> => {
    publications.value = await client.listPublications()
  }

  const publish = async (
    collection: string,
    name: string,
    busyOnly: boolean
  ): Promise<Publication> => {
    const pub = await client.publish(collection, name, busyOnly)
    await loadPublications()
    return pub
  }

  const unpublish = async (id: string): Promise<void> => {
    await client.unpublish(id)
    await loadPublications()
  }

  // Absolute URL of a public feed, for pasting into another calendar client.
  const feedUrl = (feedPath: string): string =>
    typeof window !== 'undefined' ? window.location.origin + feedPath : feedPath

  return {
    client,
    subscriptions,
    publications,
    ensureLoaded,
    refreshSubscriptions,
    addSubscription,
    removeSubscription,
    refreshOne,
    isVisible,
    toggleVisible,
    loadPublications,
    publish,
    unpublish,
    feedUrl
  }
}
