import { ref } from 'vue'
import { useClientService } from '@opencloud-eu/web-pkg'
import { CalDavClient, type CalendarCollection, type DavHttp } from '../clients/caldav'
import { newUid } from '../lib/ical'

// Module-scoped so every view shares one discovery pass and visibility state.
const home = ref('')
const calendars = ref<CalendarCollection[]>([])
const ready = ref(false)
// Dedup concurrent first-load discovery (the view's onMounted + the FullCalendar
// events callback can both call ensureReady before `ready` flips).
let discovering: Promise<void> | null = null

const VIS_KEY = 'oc-calendar-hidden'
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

const PALETTE = ['#0082c9', '#e9322d', '#46ba61', '#f1a33c', '#9a59b5', '#16a4a6', '#d6589f']

export const useCalDav = () => {
  const clientService = useClientService()
  const client = new CalDavClient(clientService.httpAuthenticated as unknown as DavHttp)

  const refresh = async (): Promise<void> => {
    home.value = await client.discoverHome()
    calendars.value = await client.listCalendars(home.value)
    ready.value = true
  }

  const ensureReady = async (force = false): Promise<void> => {
    if (ready.value && !force) {
      return
    }
    if (!discovering) {
      discovering = refresh().finally(() => {
        discovering = null
      })
    }
    await discovering
  }

  const calendarsFor = (component: string): CalendarCollection[] =>
    calendars.value.filter((c) => c.components.length === 0 || c.components.includes(component))

  const isVisible = (url: string): boolean => !hidden.value.has(url)
  const toggleVisible = (url: string): void => {
    const next = new Set(hidden.value)
    if (next.has(url)) {
      next.delete(url)
    } else {
      next.add(url)
    }
    hidden.value = next
    persistHidden()
  }

  // Full CalDAV URL (origin + path) to show so users can add it to other clients.
  const fullUrl = (path: string): string =>
    typeof window !== 'undefined' ? window.location.origin + path : path

  const createCalendar = async (displayName: string, color?: string): Promise<void> => {
    await ensureReady()
    const slug = newUid().split('@')[0]
    const c = color || PALETTE[calendars.value.length % PALETTE.length]
    await client.createCalendar(home.value, slug, displayName, c)
    await refresh()
  }

  const updateCalendar = async (
    url: string,
    props: { displayName?: string; color?: string }
  ): Promise<void> => {
    await client.setCalendarProps(url, props)
    await refresh()
  }

  const deleteCalendar = async (url: string): Promise<void> => {
    await client.deleteCalendar(url)
    const next = new Set(hidden.value)
    next.delete(url)
    hidden.value = next
    persistHidden()
    await refresh()
  }

  return {
    client,
    home,
    calendars,
    ready,
    ensureReady,
    refresh,
    calendarsFor,
    isVisible,
    toggleVisible,
    fullUrl,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    palette: PALETTE
  }
}
