// iCalendar (RFC 5545) parsing and building on top of ical.js. Events and tasks
// are stored as individual .ics objects in a CalDAV collection; here we turn
// them into the plain shapes the views use, and back.
import ICAL from 'ical.js'
import type { CalendarObject } from '../clients/caldav'
import { DAY_MS, HOUR_MS } from './constants'

const PRODID = '-//Midvault//OpenCloud Calendar//EN'

// Current time as a UTC ICAL.Time. ICAL.Time.now() returns a *floating* local
// time (serialized without 'Z'); DTSTAMP/COMPLETED must be UTC per RFC 5545.
const nowUtc = (): ICAL.Time => ICAL.Time.fromJSDate(new Date(), true)

// Convert a JS Date to an ICAL.Time for storage. All-day values are floating
// DATEs built from the date's *local* calendar components: FullCalendar and the
// editor both carry the chosen calendar day in the Date's local fields, so
// reading UTC components here would shift the day in non-UTC timezones. Timed
// values are stored as absolute UTC instants.
const toIcalTime = (d: Date, allDay: boolean): ICAL.Time => {
  if (allDay) {
    // Read the date's local calendar components into a floating time, then drop
    // the time part to make it a DATE value.
    const t = ICAL.Time.fromJSDate(d, false)
    t.isDate = true
    return t
  }
  return ICAL.Time.fromJSDate(d, true)
}

// Convert a stored ICAL.Time back to a JS Date. All-day DATEs map to local
// midnight of the same calendar day (the inverse of toIcalTime), so the day the
// user picked survives the round trip regardless of the browser's timezone.
const fromIcalTime = (t: ICAL.Time): Date =>
  t.isDate ? new Date(t.year, t.month - 1, t.day) : t.toJSDate()

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
  const vevents = comp.getAllSubcomponents('vevent')
  // Recurrence overrides (components with RECURRENCE-ID) are stored alongside
  // their master in the same object. Collect them so they can be related to the
  // master below; otherwise a modified single occurrence would render with the
  // master's original time/title instead of the edit.
  const overrides = vevents.filter((ve) => new ICAL.Event(ve).isRecurrenceException())
  for (const ve of vevents) {
    const event = new ICAL.Event(ve)
    // Skip override components themselves; the master expands them.
    if (event.isRecurrenceException()) {
      continue
    }
    for (const ov of overrides) {
      if ((ov.getFirstPropertyValue('uid') as string) === event.uid) {
        event.relateException(ov)
      }
    }
    const base = {
      uid: event.uid,
      title: event.summary || '',
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
        if (occMs >= toMs) {
          break
        }
        if (occMs + durMs <= fromMs) {
          continue
        }
        const details = event.getOccurrenceDetails(next)
        // details.item is the per-occurrence event: the master normally, or the
        // override for a modified instance. Read the display fields from it so an
        // overridden occurrence shows its edited title/time, not the master's.
        const item = details.item
        out.push({
          ...base,
          title: item.summary || '',
          description: item.description || undefined,
          location: item.location || undefined,
          allDay: item.startDate?.isDate ?? base.allDay,
          id: `${event.uid}#${details.startDate.toJSDate().getTime()}`,
          start: fromIcalTime(details.startDate),
          end: fromIcalTime(details.endDate),
          recurring: true
        })
      }
    } else {
      const start = event.startDate ? fromIcalTime(event.startDate) : undefined
      if (!start) {
        continue
      }
      const end = event.endDate ? fromIcalTime(event.endDate) : null
      // The window end is exclusive; an event ending exactly at `from` or
      // starting exactly at `to` falls outside it (avoids edge double-counting).
      if (end && end <= from) {
        continue
      }
      if (start >= to) {
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
    title: (vtodo.getFirstPropertyValue('summary') as string) || '',
    due: due ? fromIcalTime(due) : null,
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
  ve.updatePropertyWithValue('dtstamp', nowUtc())
  ve.updatePropertyWithValue('summary', e.title)
  const setOrRemove = (name: string, value?: string) => {
    ve.removeProperty(name)
    if (value) {
      ve.updatePropertyWithValue(name, value)
    }
  }
  setOrRemove('description', e.description)
  setOrRemove('location', e.location)
  // DTEND must be strictly after DTSTART (RFC 5545 §3.6.1; it is exclusive). Fall
  // back to a default span when no end is given so we never emit a zero-length or
  // DTSTART==DTEND object.
  const endDate =
    e.end && e.end.getTime() > e.start.getTime()
      ? e.end
      : new Date(e.start.getTime() + (e.allDay ? DAY_MS : HOUR_MS))
  ve.removeProperty('dtstart')
  ve.removeProperty('dtend')
  ve.removeProperty('duration') // avoid an object carrying both DTEND and DURATION
  ve.updatePropertyWithValue('dtstart', toIcalTime(e.start, e.allDay))
  ve.updatePropertyWithValue('dtend', toIcalTime(endDate, e.allDay))
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
  vtodo.updatePropertyWithValue('dtstamp', nowUtc())
  vtodo.updatePropertyWithValue('summary', t.title)
  if (t.description) {
    vtodo.updatePropertyWithValue('description', t.description)
  }
  if (t.due) {
    // A due date is a calendar day, so store it as a floating DATE rather than a
    // UTC instant (which would shift the day in non-UTC timezones).
    vtodo.updatePropertyWithValue('due', toIcalTime(t.due, true))
  }
  vtodo.updatePropertyWithValue('status', t.completed ? 'COMPLETED' : 'NEEDS-ACTION')
  if (t.completed) {
    vtodo.updatePropertyWithValue('percent-complete', 100)
    vtodo.updatePropertyWithValue('completed', nowUtc())
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
