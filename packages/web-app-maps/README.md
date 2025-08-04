# OpenCloud Maps

OpenCloud Maps app can display `.gpx` files and show geo location data for single pictures in the sidebar or for a whole folder as a folder view.

## Config

In `apps.yaml` you can override configuration like this:

```yaml
maps:
  config:
    tileLayerUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    tileLayerOptions:
      maxZoom: 19
      attribution: '© OpenStreetMap'
```

`tileLayerUrlTemplate` and `tileLayerOptions` have the above as default values, you can override it if you want to use another tile layer provider.

## Privacy Notice

The rendered maps are loaded from OpenStreetMap (by default). This allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser.
