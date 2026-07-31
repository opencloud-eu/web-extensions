# web-app-cast

This application adds Google Cast functionality to OpenCloud Web. It adds a "Cast" action to files, which sends the file to a Cast device in your network.

## Configuration

```yaml
cast:
  config:
    receiverApplicationId: 'CC1AD845'
```

- `receiverApplicationId` _(string)_ - specifies the Cast receiver application to load on the Cast device. Defaults to `CC1AD845`, the default media receiver provided by Google.

## CSP requirements

The Google Cast SDK is loaded from `www.gstatic.com`. In the file `csp.yaml`, add it to the `script-src` section:

```yaml
directives:
  script-src:
    - "'self'"
    - "'unsafe-inline'"
    - 'https://www.gstatic.com/'
```

## Privacy Notice

The Google Cast SDK is loaded by this application and interacts with Google servers. Even if it does not inject malicious code, it allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser.
