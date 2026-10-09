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

This app has CSP requirements. Make sure the [CSP files](../../README.md#content-security-policy) for your setup are loaded, or add their rules manually to your own CSP file.

## Privacy Notice

The Google Cast SDK is loaded by this application and interacts with Google servers. Even if it does not inject malicious code, it allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser.
