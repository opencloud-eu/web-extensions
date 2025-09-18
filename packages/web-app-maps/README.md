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

To enable seamless integration of traffic to the OpenStreetMap servers, the Content Security Policy of OpenCloud has to be adopted.

In the file `csp.yaml`, add the entry `- 'https://tile.openstreetmap.org/'` in the `img-src:` section.

Please respect the work of [OpenStreetMap](https://openstreetmap.org) and read the [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).

## Privacy Notice

The rendered maps are loaded from OpenStreetMap (by default). This allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser.
