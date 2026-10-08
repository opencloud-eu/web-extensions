# web-app-excalidraw

Collaborative [Excalidraw](https://excalidraw.com) whiteboards in OpenCloud Web. Registers for
the `.excalidraw` file extension, can create new whiteboards from the "New" menu, and opens
read-only for users without write access.

## Requirements

The app takes its Yjs runtime from OpenCloud Web instead of bundling its own - two copies of
Yjs on one page do not work together. Both sides have to provide it:

- at build time, through `@opencloud-eu/extension-sdk`, which lists `yjs` and
  `y-protocols/awareness` as external modules,
- at run time, through the OpenCloud that serves the app, whose Web shares those same modules
  with external apps ([opencloud-eu/web#3398](https://github.com/opencloud-eu/web/pull/3398)).

The version pinned in the root `package.json` is the build side of that, so there is no
separate version to track here. The run time side is up to the deployment: the app needs an
OpenCloud whose Web is 8.1.0 or newer. Against an older one it fails to start a session and
the browser console reports `Yjs was already imported`.

## Setup for collaboration

The app itself needs no configuration. The deployment needs two things:

1. A running [OpenCloud Yjs server](https://github.com/opencloud-eu/web/tree/main/services/yjs),
   for example the `opencloudeu/yjs` image.
2. `WEB_OPTION_YJS_SERVER_URL` pointing at it, as a websocket URL.

Routing it through OpenCloud's own reverse proxy keeps the websocket same-origin, so no
`connect-src` entry in `csp.yaml` is needed. The `docker-compose.yml` in this repository does
exactly that:

```yaml
# docker-compose.yml
yjs:
  image: opencloudeu/yjs:1.0.0
  environment:
    PORT: '1234'
    OPENCLOUD_URL: https://host.docker.internal:9200

opencloud:
  environment:
    WEB_OPTION_YJS_SERVER_URL: 'wss://host.docker.internal:9200/yjs'
```

```yaml
# dev/docker/proxy.yaml, mounted to /etc/opencloud/proxy.yaml
additional_policies:
  - name: default
    routes:
      - endpoint: /yjs
        backend: http://yjs:1234
        unprotected: true
```

The Yjs server authenticates every connection against OpenCloud's Graph API and enforces write
access per file and user, which is what makes the read-only case safe.

For the architecture behind this - room naming, hydration, stale recovery and the save loop -
see [the Yjs docs](https://github.com/opencloud-eu/web/blob/main/dev/docs/yjs.md).

## Library

The Excalidraw library - the shapes a user collects or imports - belongs to the user, not to a
whiteboard. It is stored as `/.space/excalidraw/library.excalidrawlib` in the user's personal
space; the folder is created on the first save. It is a regular `.excalidrawlib` file, so it
can be downloaded and imported elsewhere, and deleting it resets the library.

Users without a personal space, for example anonymous visitors of a public link, can still use
the library, but only for the current session.

Importing a downloaded `.excalidrawlib` file works out of the box. Adding a library directly via
"Add to Excalidraw" on [libraries.excalidraw.com](https://libraries.excalidraw.com) makes the
browser fetch it from there, which OpenCloud's default CSP blocks. To allow it, add the origin
to `connect-src` in `csp.yaml`:

```yaml
directives:
  connect-src:
    - 'https://libraries.excalidraw.com/'
```

## Known limits

Durability depends on an open browser: the Yjs server holds no state and never writes the file.
If every client closes between autosaves, edits since the last save are lost with the room.
