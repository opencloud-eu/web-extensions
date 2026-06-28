import { describe, it, expect } from 'vitest'
import {
  eventsFromObject,
  buildEventIcs,
  buildTaskIcs,
  taskFromObject,
  splitIcs
} from '../../src/lib/ical'
import type { CalendarObject } from '../../src/clients/caldav'

const obj = (data: string): CalendarObject => ({ url: '/x.ics', etag: '"1"', data })

describe('eventsFromObject', () => {
  it('expands a single event inside the window', () => {
    const ics = buildEventIcs({
      uid: 'a@x',
      title: 'Lunch',
      start: new Date('2026-06-15T11:00:00Z'),
      end: new Date('2026-06-15T12:00:00Z'),
      allDay: false
    })
    const evs = eventsFromObject(obj(ics), new Date('2026-06-01'), new Date('2026-06-30'))
    expect(evs).toHaveLength(1)
    expect(evs[0].title).toBe('Lunch')
  })

  it('still finds a long-running daily series years after its DTSTART (regression)', () => {
    // A daily series from 2021 must still render in June 2026 - the old
    // 750-iteration cap from DTSTART made it silently vanish.
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//t//EN',
      'BEGIN:VEVENT',
      'UID:daily@x',
      'DTSTART:20210101T090000Z',
      'DTEND:20210101T093000Z',
      'RRULE:FREQ=DAILY',
      'SUMMARY:Standup',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    const evs = eventsFromObject(
      obj(ics),
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-30T23:59:59Z')
    )
    expect(evs).toHaveLength(30)
    expect(evs.every((e) => e.recurring)).toBe(true)
  })

  it('returns nothing for an unparseable object instead of throwing', () => {
    expect(
      eventsFromObject(obj('not a calendar'), new Date('2026-01-01'), new Date('2026-12-31'))
    ).toEqual([])
  })

  it('applies a recurrence override (RECURRENCE-ID) to the modified occurrence', () => {
    // A daily series where one instance was moved to a different time and renamed.
    // The override must replace that occurrence, not be dropped (which would show
    // the master's original time/title).
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//t//EN',
      'BEGIN:VEVENT',
      'UID:rec@x',
      'DTSTART:20260610T090000Z',
      'DTEND:20260610T093000Z',
      'RRULE:FREQ=DAILY;COUNT=5',
      'SUMMARY:Standup',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:rec@x',
      'RECURRENCE-ID:20260612T090000Z',
      'DTSTART:20260612T140000Z',
      'DTEND:20260612T143000Z',
      'SUMMARY:Standup (moved)',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    const evs = eventsFromObject(
      obj(ics),
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-30T00:00:00Z')
    )
    expect(evs).toHaveLength(5)
    const moved = evs.find((e) => e.title === 'Standup (moved)')
    expect(moved).toBeDefined()
    expect(moved!.start.getUTCHours()).toBe(14)
  })

  it('round-trips an all-day event on the same calendar day with an exclusive end', () => {
    // Built from local calendar components; the day must survive read-back in any
    // timezone, and the stored DTEND must be the exclusive next day.
    const ics = buildEventIcs({
      uid: 'ad@x',
      title: 'Day off',
      start: new Date(2026, 5, 15),
      end: null,
      allDay: true
    })
    expect(ics).toContain('20260615')
    expect(ics).toContain('20260616') // exclusive DTEND, not a zero-length DTEND==DTSTART
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/) // DTSTAMP in UTC, not floating local
    const evs = eventsFromObject(obj(ics), new Date(2026, 5, 1), new Date(2026, 5, 30))
    expect(evs).toHaveLength(1)
    expect(evs[0].allDay).toBe(true)
    expect(evs[0].start.getFullYear()).toBe(2026)
    expect(evs[0].start.getMonth()).toBe(5)
    expect(evs[0].start.getDate()).toBe(15)
  })
})

describe('tasks', () => {
  it('round-trips a task through build and parse', () => {
    const ics = buildTaskIcs({
      uid: 't@x',
      title: 'Pay rent',
      due: new Date('2026-06-30T00:00:00Z'),
      completed: false
    })
    const t = taskFromObject(obj(ics))
    expect(t).not.toBeNull()
    expect(t!.title).toBe('Pay rent')
    expect(t!.completed).toBe(false)
    expect(t!.due).not.toBeNull()
  })

  it('marks a completed task', () => {
    const ics = buildTaskIcs({ uid: 't2@x', title: 'Done', due: null, completed: true })
    expect(taskFromObject(obj(ics))!.completed).toBe(true)
  })
})

describe('splitIcs', () => {
  it('carries VTIMEZONE into each split object', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//t//EN',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Stockholm',
      'BEGIN:STANDARD',
      'DTSTART:19701025T030000',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:tz@x',
      'DTSTART;TZID=Europe/Stockholm:20260615T100000',
      'DTEND;TZID=Europe/Stockholm:20260615T110000',
      'SUMMARY:Local meeting',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    const parts = splitIcs(ics)
    expect(parts).toHaveLength(1)
    expect(parts[0].component).toBe('VEVENT')
    expect(parts[0].ics).toContain('BEGIN:VTIMEZONE')
    expect(parts[0].ics).toContain('TZID:Europe/Stockholm')
  })
})
