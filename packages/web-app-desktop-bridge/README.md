# web-app-desktop-bridge

Announces the logged-in OpenCloud portal to the ONLYOFFICE desktop app, so the
portal shows up (and persists) in the app's **Clouds** list.

The desktop app only lists a connected cloud when the portal page itself calls
`AscDesktopEditor.execCommand('portal:login', ...)`. On Nextcloud and ownCloud
this is done by the ONLYOFFICE connector app. OpenCloud needs no connector for
the editors themselves — WOPI and the built-in collaboration service cover that
natively — so this small extension provides just the missing announcement.

Outside the desktop app (no `window.AscDesktopEditor` present) the extension
does nothing.

## How it works

On startup, when running inside the desktop app's browser shell, the extension
waits for the authenticated user to land in the runtime's user store and then
announces the portal once:

```js
AscDesktopEditor.execCommand('portal:login', JSON.stringify({
  displayName, // user's display name, falling back to the account name
  domain,      // window.location.origin
  provider: 'opencloud'
}))
```

The payload deliberately mirrors the Nextcloud connector's payload — in
particular it carries no `email` field, since the desktop app's start page
compares that field against its stored portal entry and silently drops the
event on mismatch.

Requires a desktop app that knows the `opencloud` provider (an `opencloud`
entry in the app's `providers/` directory).
