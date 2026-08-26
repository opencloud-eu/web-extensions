# web-app-importer

This application can be used for importing files and folders from other sources directly into your OpenCloud. The following sources are currently supported:

- Google Drive
- OneDrive
- OpenCloud (via public links without password)
- NextCloud (via public links without password)

## Companion setup

Make sure that you have an instance of [Uppy Companion](https://uppy.io/docs/companion/) up and running since this is the server handling the file import. It downloads the files and uploads them to the destination.

The `docker-compose.yml` in this repository includes a full working example of the importer running with Companion, you might want to use it as a reference. Please also refer to the [Uppy Companion docs](https://uppy.io/docs/companion/#options) for a full list of configuration options. Certain sources might require you to provide keys and secrets to Companion.

## Configuration

```
"config": {
  "companionUrl": "https://example.com",
  "supportedClouds": ['OneDrive', 'GoogleDrive', 'WebdavPublicLink']
}
```

- `companionUrl` _(string)_ - specifies the URL under which Companion can be reached. This config needs to be set.
- `supportedClouds` _(list[string])_ - specifies the supported cloud sources from which a user can import. Defaults to all enabled.

## CSP requirements

If Companion runs on a different origin than OpenCloud, that origin needs to be allowed in `csp.yaml`. Browsing the remote sources talks to Companion via XHR, and file thumbnails are proxied through it as well:

```yaml
directives:
  connect-src:
    - "'self'"
    - 'https://companion.example.com/'
  img-src:
    - "'self'"
    - 'data:'
    - 'blob:'
    - 'https://companion.example.com/'
```

Serving Companion under the same domain as OpenCloud (as the `docker-compose.yml` in this repository does) requires no CSP changes.
