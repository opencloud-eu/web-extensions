# Changelog

## [Unreleased]

### ✨ Features

- Initial Calendar and Tasks app for OpenCloud Web, backed by the Radicale
  CalDAV service. Month/week/day/list/year views, multiple calendars, tasks and
  iCalendar import/export.
- Localized to the user's language: the UI strings, FullCalendar month/day names,
  date formats and the first day of the week all follow the active language.

### 🐛 Bug Fixes

- Apply recurrence overrides (RECURRENCE-ID): a modified single occurrence of a
  series now shows its edited time and title instead of the master's.
- Fix all-day events landing on the wrong day in non-UTC timezones (they are now
  stored as floating DATE values built from the local calendar day), and store an
  exclusive DTEND so a single all-day event is no longer zero-length.
- Write DTSTAMP and COMPLETED in UTC, and store task due dates as DATE values.
- Return the server ETag from writes; guard against double-toggling a task.
- Reject cross-origin CalDAV hrefs, escape component names in request bodies,
  resolve the calendar-home-set, and check PROPPATCH multistatus results.

### ♿ Accessibility

- Add accessible names to the collapsed navigation and icon-only buttons, make
  iCalendar import keyboard operable, and announce error messages.
