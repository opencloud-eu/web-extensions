// iCalendar (RFC 5545) parsing and building on top of ical.js. Events and tasks
// are stored as individual .ics objects in a CalDAV collection; here we turn
// them into the plain shapes the views use, and back.
import ICAL from 'ical.js'
import type { CalendarObject } from '../clients/caldav'

const PRODID = '-//Midvault//OpenCloud Calendar//EN'

export interface CalendarEvent {
  id: string // unique per occurrence (uid or uid#timestamp for recurrences)
  uid: string
  title: string
  start: Date
  end: Date | null
  allDay: boolean
  description?: string
  location?: string
  recurring: boolean
  url: string
  etag: string
}

export interface TaskItem {
  uid: string
  title: string
  due: Date | null
  completed: boolean
  description?: string
  url: string
  etag: string
}

const vcalendar = (inner: ICAL.Component, extras: ICAL.Component[] = []): string => {
  const cal = new ICAL.Component(['vcalendar', [], []])
  cal.updatePropertyWithValue('prodid', PRODID)
  cal.updatePropertyWithValue('version', '2.0')
  for (const c of extras) {
    cal.addSubcomponent(c)
  }
  cal.addSubcomponent(inner)
  return cal.toString()
}

// Expand a single .ics object into the event occurrences that fall in [from,to].
export const eventsFromObject = (obj: CalendarObject, from: Date, to: Date): CalendarEvent[] => {
  let comp: ICAL.Component
  try {
    comp = new ICAL.Component(ICAL.parse(obj.data))
  } catch (e) {
    console.warn('calendar: skipping unparseable object', obj.url, e)
    return []
  }
  const out: CalendarEvent[] = []
  for (const ve of comp.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(ve)
    // Skip recurrence-override components; the master handles expansion.
    if (event.isRecurrenceException()) {
      continue
    }
    const base = {
      uid: event.uid,
      title: event.summary || '(no title)',
      description: event.description || undefined,
      location: event.location || undefined,
      allDay: event.startDate?.isDate ?? false,
      url: obj.url,
      etag: obj.etag
    }
    if (event.isRecurring()) {
      // Cheaply skip occurrences that end before the window (without the cost of
      // getOccurrenceDetails) so a long-running daily series created years ago
      // still reaches the visible range. The duration keeps multi-day spanning
      // events that started before `from`. A high guard bounds pathological rules.
      const startMs = event.startDate?.toJSDate().getTime() ?? 0
      const endMs = event.endDate?.toJSDate().getTime() ?? startMs
      const durMs = Math.max(0, endMs - startMs)
      const fromMs = from.getTime()
      const toMs = to.getTime()
      const it = event.iterator()
      let next: ICAL.Time | null
      let guard = 0
      while ((next = it.next())) {
        if (guard++ > 100000) {
          break
        }
        const occMs = next.toJSDate().getTime()
        if (occMs > toMs) {
          break
        }
        if (occMs + durMs < fromMs) {
          continue
        }
        const details = event.getOccurrenceDetails(next)
        out.push({
          ...base,
          id: `${event.uid}#${details.startDate.toJSDate().getTime()}`,
          start: details.startDate.toJSDate(),
          end: details.endDate.toJSDate(),
          recurring: true
        })
      }
    } else {
      const start = event.startDate?.toJSDate()
      if (!start) {
        continue
      }
      const end = event.endDate?.toJSDate() ?? null
      if (end && end < from) {
        continue
      }
      if (start > to) {
        continue
      }
      out.push({ ...base, id: event.uid, start, end, recurring: false })
    }
  }
  return out
}

export const taskFromObject = (obj: CalendarObject): TaskItem | null => {
  let comp: ICAL.Component
  try {
    comp = new ICAL.Component(ICAL.parse(obj.data))
  } catch (e) {
    console.warn('calendar: skipping unparseable task', obj.url, e)
    return null
  }
  const vtodo = comp.getFirstSubcomponent('vtodo')
  if (!vtodo) {
    return null
  }
  const due = vtodo.getFirstPropertyValue('due') as ICAL.Time | null
  const status = (vtodo.getFirstPropertyValue('status') as string) || ''
  return {
    uid: (vtodo.getFirstPropertyValue('uid') as string) || '',
    title: (vtodo.getFirstPropertyValue('summary') as string) || '(no title)',
    due: due ? due.toJSDate() : null,
    completed: status.toUpperCase() === 'COMPLETED',
    description: (vtodo.getFirstPropertyValue('description') as string) || undefined,
    url: obj.url,
    etag: obj.etag
  }
}

export interface EventInput {
  uid: string
  title: string
  start: Date
  end: Date | null
  allDay: boolean
  description?: string
  location?: string
}

// Apply the editable fields onto a vevent component (shared by create + edit).
const applyEventFields = (ve: ICAL.Component, e: EventInput): void => {
  ve.updatePropertyWithValue('dtstamp', ICAL.Time.now())
  ve.updatePropertyWithValue('summary', e.title)
  const setOrRemove = (name: string, value?: string) => {
    ve.removeProperty(name)
    if (value) {
      ve.updatePropertyWithValue(name, value)
    }
  }
  setOrRemove('description', e.description)
  setOrRemove('location', e.location)
  const start = ICAL.Time.fromJSDate(e.start, true)
  const end = ICAL.Time.fromJSDate(e.end ?? e.start, true)
  if (e.allDay) {
    start.isDate = true
    end.isDate = true
  }
  ve.removeProperty('dtstart')
  ve.removeProperty('dtend')
  ve.updatePropertyWithValue('dtstart', start)
  ve.updatePropertyWithValue('dtend', end)
}

export const buildEventIcs = (e: EventInput): string => {
  const ve = new ICAL.Component('vevent')
  ve.updatePropertyWithValue('uid', e.uid)
  applyEventFields(ve, e)
  return vcalendar(ve)
}

// Edit an existing object's first VEVENT in place, preserving RRULE and other
// properties we don't expose (so editing a recurring series keeps recurring).
export const editEventIcs = (rawIcs: string, e: EventInput): string => {
  const comp = new ICAL.Component(ICAL.parse(rawIcs))
  const ve = comp.getFirstSubcomponent('vevent')
  if (!ve) {
    return buildEventIcs(e)
  }
  applyEventFields(ve, e)
  return comp.toString()
}

// Split an uploaded .ics into one self-contained VCALENDAR per VEVENT/VTODO,
// for importing each as its own CalDAV object.
export const splitIcs = (ics: string): { uid: string; component: string; ics: string }[] => {
  const comp = new ICAL.Component(ICAL.parse(ics))
  // Carry VTIMEZONE definitions into each split object, otherwise events that
  // reference a TZID lose their timezone and get the wrong offset on import.
  const timezones = comp.getAllSubcomponents('vtimezone')
  const out: { uid: string; component: string; ics: string }[] = []
  for (const name of ['vevent', 'vtodo']) {
    for (const sub of comp.getAllSubcomponents(name)) {
      let uid = (sub.getFirstPropertyValue('uid') as string) || newUid()
      // De-duplicate recurrence overrides that share a uid.
      if (sub.getFirstPropertyValue('recurrence-id')) {
        uid = `${uid}-${out.length}`
      }
      out.push({ uid, component: name.toUpperCase(), ics: vcalendar(sub, timezones) })
    }
  }
  return out
}

// Merge several objects' components into one VCALENDAR for export.
export const mergeIcs = (rawList: string[]): string => {
  const cal = new ICAL.Component(['vcalendar', [], []])
  cal.updatePropertyWithValue('prodid', PRODID)
  cal.updatePropertyWithValue('version', '2.0')
  for (const raw of rawList) {
    try {
      const c = new ICAL.Component(ICAL.parse(raw))
      for (const name of ['vevent', 'vtodo', 'vtimezone']) {
        for (const sub of c.getAllSubcomponents(name)) {
          cal.addSubcomponent(sub)
        }
      }
    } catch {
      // skip malformed objects
    }
  }
  return cal.toString()
}

export interface TaskInput {
  uid: string
  title: string
  due: Date | null
  completed: boolean
  description?: string
}

export const buildTaskIcs = (t: TaskInput): string => {
  const vtodo = new ICAL.Component('vtodo')
  vtodo.updatePropertyWithValue('uid', t.uid)
  vtodo.updatePropertyWithValue('dtstamp', ICAL.Time.now())
  vtodo.updatePropertyWithValue('summary', t.title)
  if (t.description) {
    vtodo.updatePropertyWithValue('description', t.description)
  }
  if (t.due) {
    vtodo.updatePropertyWithValue('due', ICAL.Time.fromJSDate(t.due, true))
  }
  vtodo.updatePropertyWithValue('status', t.completed ? 'COMPLETED' : 'NEEDS-ACTION')
  if (t.completed) {
    vtodo.updatePropertyWithValue('percent-complete', 100)
    vtodo.updatePropertyWithValue('completed', ICAL.Time.now())
  }
  return vcalendar(vtodo)
}

export const newUid = (): string => {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  // The domain part of a UID only needs to be a stable, instance-specific token;
  // derive it from the current host instead of hardcoding one deployment.
  const host = (typeof window !== 'undefined' && window.location?.hostname) || 'opencloud.local'
  return `${rnd}@${host}`
}
