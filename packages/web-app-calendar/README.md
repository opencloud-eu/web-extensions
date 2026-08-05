# web-app-calendar

A Calendar and Tasks app for OpenCloud Web.

It is a pure frontend extension: it speaks CalDAV to the same-origin `/caldav/`
endpoint with the logged-in session, backed by OpenCloud's Radicale
(CalDAV/CardDAV) service. OpenCloud already advertises that backend to clients
through the `support_radicale` capability, so there is no extra backend to run
for local calendars and tasks.

## Features

- Month, week, day, list and year views (FullCalendar).
- Multiple calendars with per-calendar colour and visibility.
- Tasks (VTODO) with create, complete and delete.
- iCalendar import and export per calendar.
- Optional external calendar subscriptions and public sharing through the
  companion `oc-calendar-bridge` service (configured via `caldavRoot` /
  `bridgeBase` in the app's `config.json`).

## How it works

- Discovery: `PROPFIND /caldav/` for the principal and calendar home, then list
  the calendar collections.
- Events: `REPORT` `calendar-query` for `VEVENT`; create/update with `PUT` of an
  `.ics`, delete with `DELETE` using `If-Match` etags.
- Tasks: the same flow for `VTODO`.
- Rendering: FullCalendar; iCalendar parsing/building via `ical.js`.

## Configuration

Per-deployment overrides may be supplied in the app's `config.json`:

```json
{ "caldavRoot": "/caldav/", "bridgeBase": "/calendar-bridge" }
```

Both are optional and default to the values above.
