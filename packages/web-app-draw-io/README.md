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

This app has CSP requirements. Make sure the [CSP files](../../README.md#content-security-policy) for your setup are loaded, or add their rules manually to your own CSP file.

If you configure a different `url`, allow that host in `frame-src` instead.

## Privacy Notice

By default the editor is loaded from `embed.diagrams.net`. This allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser. Use a self-hosted draw.io instance via the `url` config option to avoid this.
