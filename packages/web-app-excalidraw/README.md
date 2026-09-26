# web-app-excalidraw

Collaborative [Excalidraw](https://excalidraw.com) whiteboards in OpenCloud Web. Registers for
the `.excalidraw` file extension, can create new whiteboards from the "New" menu, and opens
read-only for users without write access.

## Requirements

Requires OpenCloud <!-- TODO: fill in the release that ships this --> or newer. Older
versions still open and save whiteboards, but every client works on its own copy and
changes are not shared.

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

## Known limits

Durability depends on an open browser: the Yjs server holds no state and never writes the file.
If every client closes between autosaves, edits since the last save are lost with the room.
