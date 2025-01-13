# web-app-importer

This application can be used for importing files and folders from other sources directly into your OpenCloud. The following sources are currently supported:

- Google Drive
- Onedrive
- OpenCloud (via public links without password)
- NextCloud (via public links without password)

## Companion setup

Make sure that you have an instance of [Uppy Companion](https://uppy.io/docs/companion/) up and running since this is the server handling the file import. It downloads the files and uploads them to the destination.

The `docker-compose.yml` in this repository includes a full working example of the importer running with Companion, you might want to use it as a reference. Please also refer to the [Uppy Companion docs](https://uppy.io/docs/companion/#options) for a full list of configuration options. Certain sources might require you to provide keys and secrets to Companion.

## App config

```
"config": {
  "companionUrl": "https://example.com",
  "supportedClouds": ['OneDrive', 'GoogleDrive', 'WebdavPublicLink'],
  "webdavCloudType": "opencloud"
}
```

- `companionUrl` _(string)_ - specifies the URL under which Companion can be reached. This config needs to be set.
- `supportedClouds` _(list[string])_ - specifies the supported cloud sources from which a user can import. Defaults to all enabled.
- `webdavCloudType` _(string)_ - limit the webdav import to either `opencloud` or `nextcloud`. Defaults to allowing both.
