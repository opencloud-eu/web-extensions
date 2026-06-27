<template>
  <div class="cal-shell">
    <aside class="cal-sidebar" :class="{ collapsed: sideCollapsed }">
      <div class="cal-side-head">
        <oc-button
          appearance="raw"
          :title="sideCollapsed ? $gettext('Show calendars') : $gettext('Hide calendars')"
          @click="toggleSide"
        >
          <oc-icon :name="sideCollapsed ? 'menu-unfold' : 'menu-fold'" fill-type="line" />
        </oc-button>
      </div>

      <template v-if="!sideCollapsed">
        <oc-button class="cal-new" appearance="filled" @click="newEvent">
          <oc-icon name="add" fill-type="line" size="small" />
          {{ $gettext('New event') }}
        </oc-button>

        <div class="cal-target">
          <oc-select
            :label="$gettext('New events in')"
            :options="writable"
            :get-option-label="optionLabel"
            :model-value="targetCalendar"
            :clearable="false"
            :searchable="false"
            @update:model-value="onTargetChange"
          />
        </div>

        <div class="cal-list">
          <span class="cal-label">{{ $gettext('Calendars') }}</span>
          <div v-for="c in calendars" :key="c.url" class="cal-list-item">
            <span class="cal-dot" :style="{ background: c.color || '#0082c9' }" />
            <oc-checkbox
              :model-value="isVisible(c.url)"
              :label="c.displayName"
              @update:model-value="onToggle(c.url)"
            />
          </div>
        </div>
      </template>
    </aside>

    <div class="cal-main">
      <div v-if="loadError" class="cal-banner">{{ loadError }}</div>
      <FullCalendar ref="fc" :options="options" class="cal-fc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  CalendarOptions,
  EventClickArg,
  EventInput,
  DateSelectArg,
  EventDropArg
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useGettext } from 'vue3-gettext'
import { useModals } from '@opencloud-eu/web-pkg'
import { useCalDav } from '../composables/useCalDav'
import type { CalendarCollection } from '../clients/caldav'
import {
  eventsFromObject,
  buildEventIcs,
  editEventIcs,
  newUid,
  type CalendarEvent,
  type EventInput as IcsInput
} from '../lib/ical'
import EventModal from '../components/EventModal.vue'

const { $gettext } = useGettext()
const { dispatchModal } = useModals()
const { client, calendars, ensureReady, calendarsFor, isVisible, toggleVisible } = useCalDav()

const fc = ref<InstanceType<typeof FullCalendar> | null>(null)
const loadError = ref('')
const targetUrl = ref('')

const SIDE_KEY = 'oc-calendar-side-collapsed'
const sideCollapsed = ref(localStorage.getItem(SIDE_KEY) === '1')
const toggleSide = () => {
  sideCollapsed.value = !sideCollapsed.value
  localStorage.setItem(SIDE_KEY, sideCollapsed.value ? '1' : '0')
}

const writable = computed(() => calendarsFor('VEVENT'))

// OcSelect works with the calendar object; we keep targetUrl as the source of truth.
const targetCalendar = computed(() => writable.value.find((c) => c.url === targetUrl.value) || null)
const optionLabel = (o: unknown) => (o as CalendarCollection).displayName
const onTargetChange = (c: CalendarCollection | null) => {
  if (c) {
    targetUrl.value = c.url
  }
}

const refetch = () => fc.value?.getApi().refetchEvents()

const onToggle = (url: string) => {
  toggleVisible(url)
  refetch()
}

const loadEvents = async (start: Date, end: Date): Promise<EventInput[]> => {
  await ensureReady()
  if (!targetUrl.value && writable.value[0]) {
    targetUrl.value = writable.value[0].url
  }
  const out: EventInput[] = []
  for (const cal of writable.value) {
    if (!isVisible(cal.url)) {
      continue
    }
    const objects = await client.listObjects(cal.url, 'VEVENT')
    for (const obj of objects) {
      for (const ev of eventsFromObject(obj, start, end)) {
        out.push({
          id: ev.id,
          title: ev.title,
          start: ev.start,
          end: ev.end ?? undefined,
          allDay: ev.allDay,
          editable: !ev.recurring,
          ...(cal.color ? { color: cal.color } : {}),
          extendedProps: {
            uid: ev.uid,
            url: ev.url,
            etag: ev.etag,
            description: ev.description,
            location: ev.location,
            recurring: ev.recurring
          }
        })
      }
    }
  }
  return out
}

const writeNew = async (input: IcsInput) => {
  const uid = newUid()
  const url = (targetUrl.value || writable.value[0]?.url) + encodeURIComponent(uid) + '.ics'
  await client.putObject(url, buildEventIcs({ ...input, uid }))
  refetch()
}

const newEvent = () => {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  openCreate(start, new Date(start.getTime() + 3600000), false)
}

const openCreate = (start: Date, end: Date, allDay: boolean) => {
  if (!writable.value.length) {
    loadError.value = $gettext('No writable calendar found')
    return
  }
  dispatchModal({
    title: $gettext('New event'),
    hideActions: true,
    customComponent: EventModal,
    customComponentAttrs: () => ({
      event: null,
      initialStart: start,
      initialEnd: end,
      initialAllDay: allDay,
      onSubmit: async (i: IcsInput) => writeNew(i),
      onRemove: null
    })
  })
}

// Persist a moved/resized event, preserving everything else in the object.
const persistMove = async (arg: EventDropArg | EventResizeDoneArg) => {
  const e = arg.event
  const url = e.extendedProps.url as string
  const etag = e.extendedProps.etag as string
  try {
    const raw = await client.getObjectRaw(url)
    const ics = editEventIcs(raw, {
      uid: e.extendedProps.uid as string,
      title: e.title,
      start: e.start ?? new Date(),
      end: e.end,
      allDay: e.allDay,
      description: e.extendedProps.description as string | undefined,
      location: e.extendedProps.location as string | undefined
    })
    await client.putObject(url, ics, etag)
    refetch()
  } catch (err) {
    loadError.value = (err as Error).message || $gettext('Could not move event')
    arg.revert()
  }
}

const openEdit = (arg: EventClickArg) => {
  const e = arg.event
  if (!e.extendedProps.url) {
    return
  }
  const url = e.extendedProps.url as string
  const etag = e.extendedProps.etag as string
  if (e.extendedProps.recurring) {
    dispatchModal({
      title: $gettext('Recurring event'),
      message: $gettext(
        'This event repeats. Editing applies to the whole series; or delete the series.'
      ),
      hideActions: false,
      customComponent: EventModal,
      customComponentAttrs: () => ({
        event: toCalendarEvent(e, url, etag),
        initialStart: e.start ?? new Date(),
        initialEnd: e.end ?? e.start ?? new Date(),
        initialAllDay: e.allDay,
        onSubmit: async (i: IcsInput) => editSeries(url, etag, i),
        onRemove: async () => {
          await client.deleteObject(url, etag)
          refetch()
        }
      })
    })
    return
  }
  dispatchModal({
    title: $gettext('Edit event'),
    hideActions: true,
    customComponent: EventModal,
    customComponentAttrs: () => ({
      event: toCalendarEvent(e, url, etag),
      initialStart: e.start ?? new Date(),
      initialEnd: e.end ?? e.start ?? new Date(),
      initialAllDay: e.allDay,
      onSubmit: async (i: IcsInput) => editSeries(url, etag, i),
      onRemove: async () => {
        await client.deleteObject(url, etag)
        refetch()
      }
    })
  })
}

const editSeries = async (url: string, etag: string, input: IcsInput) => {
  const raw = await client.getObjectRaw(url)
  await client.putObject(url, editEventIcs(raw, input), etag)
  refetch()
}

const toCalendarEvent = (e: EventClickArg['event'], url: string, etag: string): CalendarEvent => ({
  id: e.id,
  uid: e.extendedProps.uid as string,
  title: e.title,
  start: e.start ?? new Date(),
  end: e.end,
  allDay: e.allDay,
  description: e.extendedProps.description as string | undefined,
  location: e.extendedProps.location as string | undefined,
  recurring: !!e.extendedProps.recurring,
  url,
  etag
})

const options = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay,listWeek'
  },
  buttonText: {
    today: $gettext('today'),
    year: $gettext('year'),
    month: $gettext('month'),
    week: $gettext('week'),
    day: $gettext('day'),
    list: $gettext('list')
  },
  height: '100%',
  firstDay: 1,
  weekNumbers: true,
  nowIndicator: true,
  selectable: true,
  editable: true,
  events: (info, success, failure) => {
    loadEvents(info.start, info.end)
      .then((events) => {
        loadError.value = ''
        success(events)
      })
      .catch((e: Error) => {
        loadError.value = e.message || $gettext('Could not load events')
        failure(e)
      })
  },
  select: (sel: DateSelectArg) => openCreate(sel.start, sel.end, sel.allDay),
  eventClick: openEdit,
  eventDrop: persistMove,
  eventResize: persistMove
}))

onMounted(() => {
  ensureReady().catch((e) => {
    loadError.value = (e as Error).message || $gettext('Could not load calendars')
  })
})
</script>

<style scoped>
.cal-shell {
  height: 100%;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  box-sizing: border-box;
}
.cal-sidebar {
  width: 230px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  transition: width 0.15s ease;
}
.cal-sidebar.collapsed {
  width: auto;
  gap: 0;
}
.cal-side-head {
  display: flex;
  justify-content: flex-end;
}
.cal-new {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}
.cal-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--oc-role-on-surface-variant);
}
.cal-target {
  display: flex;
  flex-direction: column;
}
.cal-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cal-list-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
}
.cal-list-item:hover {
  background: var(--oc-role-surface-container);
}
.cal-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cal-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.cal-banner {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: var(--oc-role-error-container);
  color: var(--oc-role-on-error-container);
}
/* Map FullCalendar's theming variables onto OpenCloud design tokens so the
   grid blends in. Custom properties inherit into FullCalendar's own DOM. */
.cal-fc {
  flex: 1;
  min-height: 0;
  --fc-border-color: var(--oc-role-outline-variant);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: var(--oc-role-surface-container);
  --fc-today-bg-color: var(--oc-role-surface-container-high);
  --fc-button-text-color: var(--oc-role-on-surface);
  --fc-button-bg-color: var(--oc-role-surface-container);
  --fc-button-border-color: var(--oc-role-outline-variant);
  --fc-button-hover-bg-color: var(--oc-role-surface-container-high);
  --fc-button-hover-border-color: var(--oc-role-outline);
  --fc-button-active-bg-color: var(--oc-role-primary);
  --fc-button-active-border-color: var(--oc-role-primary);
  --fc-now-indicator-color: var(--oc-role-error);
  font-family: inherit;
}
.cal-fc :deep(.fc .fc-button) {
  border-radius: 0.5rem;
  text-transform: none;
  font-weight: 500;
  box-shadow: none;
}
.cal-fc :deep(.fc .fc-toolbar-title) {
  font-size: 1.25rem;
}
.cal-fc :deep(.fc-theme-standard .fc-scrollgrid) {
  border-radius: 0.5rem;
  overflow: hidden;
}
</style>
