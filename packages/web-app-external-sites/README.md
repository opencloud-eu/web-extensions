# web-app-external-sites

This application can be used for adding external sites to the application menu of OpenCloud Web. External sites can either be opened in a new tab/window or embedded within OpenCloud Web via an iFrame.

## Configuration

The configuration for the external-sites app may look like so:

```
"config": {
  "sites": [
    {
      "name": "OpenCloud",
      "url": "https://www.opencloud.eu",
      "target": "external",
      "color": "#0D856F",
      "icon": "cloud",
      "priority": 50
    }
  ]
}
```

The `name` will appear in the app menu, while `url` specifies the url which will be opened or embedded. `target` can either be `external` or `embedded`. Choose `external` if the site should be opened in a new tab or window. Choose `embedded` if the external content should be embedded within OpenCloud Web. Note that the target server needs to allow being embedded via its CORS settings. The server running OpenCloud on the other hand needs to allow embedding the target via its CSP rules. If you don't have control over any of the server's CORS or CSP settings, just test it. If embedded doesn't work for the specified url then you need to use `external` instead.

All of these 3 config options are required.

The following attributes are optional:

- `color` _(string)_ - specifies the Hex color codes of the icon background of the menu item.
- `icon` _(string)_ - specifies the name of a [Remix Icon](https://remixicon.com/) to be used for the menu item.
- `priority` _(number)_ - specifies the order of the menu item. `50` is probably a good place to start, then go up/down based on where the item should be placed. Defaults to the highest possible number, so the item will most likely end up at the bottom of the list.

Please refer to [the Web app docs](https://docs.opencloud.eu/docs/admin/configuration/web-applications) if you want to learn how to configure a Web app.
