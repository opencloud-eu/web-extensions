# web-app-unzip

This application provides a way to extract `zip` archives on the client side. The extraction utilizes web workers to ensure the web ui stays responsive during the process.

## Configuration

In `apps.yaml` you can override configuration like this:

```yaml
unzip:
  config:
    maxArchiveSize: 1000000000
```

`maxArchiveSize` sets the maximum size of an archive that can be extracted, in bytes. Archives above that size show a disabled action with a tooltip stating the limit. Defaults to `64000000` (64 MB).

Keep in mind that extraction happens in the browser, so the whole archive and its extracted contents have to fit into the memory of the client machine.
