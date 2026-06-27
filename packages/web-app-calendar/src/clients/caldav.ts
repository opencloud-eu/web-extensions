// A small CalDAV client that talks to OpenCloud's built-in Radicale service at
// the same-origin /caldav/ endpoint. It uses the web client's authenticated
// axios instance, so the logged-in session token is carried automatically and
// the OpenCloud proxy injects the user identity to Radicale (X-Remote-User).
//
// We hand-roll the protocol (PROPFIND / REPORT / PUT / DELETE) rather than use a
// third-party DAV library, because those issue bare fetch() calls that would not
// carry OpenCloud's bearer auth.

const DAV_NS = 'DAV:'
const CAL_NS = 'urn:ietf:params:xml:ns:caldav'
const APPLE_NS = 'http://apple.com/ns/ical/'

// Same-origin path the OpenCloud proxy forwards to the CalDAV backend (Radicale)
// with X-Remote-User injected. Defaults to /caldav/ but can be overridden via the
// app's config.json (caldavRoot) for deployments that mount it elsewhere.
export let CALDAV_ROOT = '/caldav/'
export const setCaldavRoot = (v?: string): void => {
  if (v && v.trim()) {
    CALDAV_ROOT = v.endsWith('/') ? v : v + '/'
  }
}

export interface CalendarCollection {
  url: string
  displayName: string
  color?: string
  components: string[]
}

export interface CalendarObject {
  url: string
  etag: string
  data: string
}

// Minimal shape of the authenticated axios instance from useClientService().
export interface DavHttp {
  request(config: {
    method: string
    url: string
    data?: string
    headers?: Record<string, string>
    responseType?: 'text'
  }): Promise<{ data: string; status: number; headers: Record<string, string> }>
}

const parser = new DOMParser()

const parseXml = (text: string): Document => {
  const doc = parser.parseFromString(text, 'application/xml')
  // DOMParser reports malformed XML as a <parsererror> document rather than
  // throwing; surface it so a broken DAV response isn't read as "empty".
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('malformed XML response from the CalDAV server')
  }
  return doc
}

// Collect direct text of the first <ns:local> under an element.
const firstText = (el: Element, ns: string, local: string): string => {
  const found = el.getElementsByTagNameNS(ns, local)
  return found.length ? (found[0].textContent ?? '').trim() : ''
}

export class CalDavClient {
  constructor(private http: DavHttp) {}

  private async dav(
    method: string,
    url: string,
    body?: string,
    depth?: string
  ): Promise<{ data: string; status: number }> {
    const headers: Record<string, string> = {}
    if (body !== undefined) {
      headers['Content-Type'] = 'application/xml; charset=utf-8'
    }
    if (depth !== undefined) {
      headers['Depth'] = depth
    }
    const res = await this.http.request({ method, url, data: body, headers, responseType: 'text' })
    return { data: res.data, status: res.status }
  }

  // Resolve the calendar home (== current-user-principal in Radicale).
  async discoverHome(): Promise<string> {
    const body = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`
    const { data } = await this.dav('PROPFIND', CALDAV_ROOT, body, '0')
    const doc = parseXml(data)
    const principals = doc.getElementsByTagNameNS(DAV_NS, 'current-user-principal')
    if (principals.length) {
      const href = firstText(principals[0] as Element, DAV_NS, 'href')
      if (href) {
        return href.endsWith('/') ? href : href + '/'
      }
    }
    throw new Error('could not resolve CalDAV principal')
  }

  // List the calendar collections under the home.
  async listCalendars(home: string): Promise<CalendarCollection[]> {
    const body = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop><d:resourcetype/><d:displayname/><a:calendar-color/><c:supported-calendar-component-set/></d:prop></d:propfind>`
    const { data } = await this.dav('PROPFIND', home, body, '1')
    const doc = parseXml(data)
    const responses = Array.from(doc.getElementsByTagNameNS(DAV_NS, 'response'))
    const out: CalendarCollection[] = []
    for (const res of responses) {
      const rt = res.getElementsByTagNameNS(DAV_NS, 'resourcetype')[0]
      const isCalendar = !!rt && rt.getElementsByTagNameNS(CAL_NS, 'calendar').length > 0
      if (!isCalendar) {
        continue
      }
      const url = firstText(res, DAV_NS, 'href')
      const comps = Array.from(res.getElementsByTagNameNS(CAL_NS, 'comp')).map(
        (c) => (c as Element).getAttribute('name') || ''
      )
      out.push({
        url,
        displayName: firstText(res, DAV_NS, 'displayname') || url,
        color: firstText(res, APPLE_NS, 'calendar-color') || undefined,
        components: comps
      })
    }
    return out
  }

  // Fetch all objects of a component type (VEVENT or VTODO) from a collection.
  async listObjects(collectionUrl: string, component: string): Promise<CalendarObject[]> {
    const body = `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="${component}"/></c:comp-filter></c:filter></c:calendar-query>`
    const { data } = await this.dav('REPORT', collectionUrl, body, '1')
    const doc = parseXml(data)
    const responses = Array.from(doc.getElementsByTagNameNS(DAV_NS, 'response'))
    const out: CalendarObject[] = []
    for (const res of responses) {
      const calData = firstText(res, CAL_NS, 'calendar-data')
      if (!calData) {
        continue
      }
      out.push({
        url: firstText(res, DAV_NS, 'href'),
        etag: firstText(res, DAV_NS, 'getetag'),
        data: calData
      })
    }
    return out
  }

  // Create or update a single object. For updates pass the known etag.
  async putObject(url: string, ics: string, etag?: string): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'text/calendar; charset=utf-8' }
    if (etag) {
      headers['If-Match'] = etag
    } else {
      headers['If-None-Match'] = '*'
    }
    await this.http.request({ method: 'PUT', url, data: ics, headers, responseType: 'text' })
  }

  async deleteObject(url: string, etag?: string): Promise<void> {
    const headers: Record<string, string> = {}
    if (etag) {
      headers['If-Match'] = etag
    }
    await this.http.request({ method: 'DELETE', url, headers, responseType: 'text' })
  }

  // Fetch one object's raw iCalendar text (for export / editing a series).
  async getObjectRaw(url: string): Promise<string> {
    const res = await this.http.request({ method: 'GET', url, responseType: 'text' })
    return res.data
  }

  // Create a new calendar collection (MKCALENDAR) under the home.
  async createCalendar(
    home: string,
    slug: string,
    displayName: string,
    color: string,
    components: string[] = ['VEVENT', 'VTODO']
  ): Promise<string> {
    const url = home + encodeURIComponent(slug) + '/'
    const comps = components.map((c) => `<c:comp name="${c}"/>`).join('')
    const body = `<?xml version="1.0"?><c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:set><d:prop><d:displayname>${escapeXml(displayName)}</d:displayname><c:supported-calendar-component-set>${comps}</c:supported-calendar-component-set><a:calendar-color>${escapeXml(color)}</a:calendar-color></d:prop></d:set></c:mkcalendar>`
    await this.dav('MKCALENDAR', url, body)
    return url
  }

  // Update a calendar's display name and/or color (PROPPATCH).
  async setCalendarProps(
    url: string,
    props: { displayName?: string; color?: string }
  ): Promise<void> {
    const set: string[] = []
    if (props.displayName !== undefined) {
      set.push(`<d:displayname>${escapeXml(props.displayName)}</d:displayname>`)
    }
    if (props.color !== undefined) {
      set.push(`<a:calendar-color>${escapeXml(props.color)}</a:calendar-color>`)
    }
    if (!set.length) {
      return
    }
    const body = `<?xml version="1.0"?><d:propertyupdate xmlns:d="DAV:" xmlns:a="http://apple.com/ns/ical/"><d:set><d:prop>${set.join('')}</d:prop></d:set></d:propertyupdate>`
    await this.dav('PROPPATCH', url, body)
  }

  // Delete a whole calendar collection.
  async deleteCalendar(url: string): Promise<void> {
    await this.http.request({ method: 'DELETE', url, responseType: 'text' })
  }
}

const escapeXml = (s: string): string =>
  s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
