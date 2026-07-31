# web-app-draw-io

This application can be used for creating, opening and editing `.drawio` files. It also opens `.vsdx` files, which get imported by the editor. The editor itself is not part of this application, it gets embedded via an iFrame.

## Configuration

```yaml
draw-io:
  config:
    url: 'https://embed.diagrams.net'
    theme: 'minimal'
```

- `url` _(string)_ - specifies the URL of the draw.io instance to embed. Defaults to `https://embed.diagrams.net`. Point it to a self-hosted instance if you don't want to rely on the public one.
- `theme` _(string)_ - specifies the editor theme, passed to draw.io as its [`ui` URL parameter](https://www.drawio.com/doc/faq/supported-url-parameters). Defaults to `minimal`.

## CSP requirements

The embedded editor needs to be allowed as an iFrame source. In the file `csp.yaml`, add the draw.io URL to the `frame-src` section:

```yaml
directives:
  frame-src:
    - "'self'"
    - 'https://embed.diagrams.net/'
```

`https://embed.diagrams.net/` is part of the default OpenCloud CSP configuration. If you configure a different `url`, that host needs to be added instead.

## Privacy Notice

By default the editor is loaded from `embed.diagrams.net`. This allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser. Use a self-hosted draw.io instance via the `url` config option to avoid this.
