# OpenCloud Maps

OpenCloud Maps app can display `.gpx` files and show geo location data for single pictures in the sidebar or for a whole folder as a folder view.

## Location data

The sidebar panel and the folder view use the location stored on each file, which WebDAV returns as `oc:location`. The app does not read EXIF data itself: the location is written by OpenCloud's search service, and only its [Tika extractor](https://docs.opencloud.eu/docs/dev/server/services/search/information#tika) reads GPS data. With the default `basic` extractor, pictures never get a location and the folder view shows "No files with location data". Pictures that were indexed before switching to Tika need a [forced rescan](https://docs.opencloud.eu/docs/dev/server/services/search/information#manually-trigger-re-indexing-a-space).

## Configuration

In `apps.yaml` you can override configuration like this:

### Folder view

```yaml
maps:
  config:
    folderViewEnabled: true
```

`folderViewEnabled` adds a map folder view, showing the geo location data of all pictures in the current folder. Defaults to `false`.

### Raster tiles (default)

```yaml
maps:
  config:
    tileLayerUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    tileLayerAttribution: '<a href="https://openstreetmap.org">OpenStreetMap</a>'
    tileLayerOptions:
      maxZoom: 19
```

`tileLayerUrlTemplate` defaults to OpenStreetMap. `tileLayerAttribution` defaults to OpenStreetMap when using raster tiles.

### PMTiles (vector tiles)

For vector tile maps using [PMTiles](https://protomaps.com/docs/pmtiles), point `tileLayerUrlTemplate` to a `.pmtiles` file:

```yaml
maps:
  config:
    tileLayerUrlTemplate: 'https://example.com/tiles/region.pmtiles'
    tileLayerAttribution: '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org">OpenStreetMap</a>'
```

Vector tile labels require font glyphs. By default, fonts are loaded from `protomaps.github.io`. To use self-hosted fonts instead, set `tileLayerGlyphs`:

```yaml
maps:
  config:
    tileLayerUrlTemplate: 'https://example.com/tiles/region.pmtiles'
    tileLayerGlyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf'
```

#### Self-hosting tiles

A self-contained tile server is available in [`contrib/pmtiles-server/`](contrib/pmtiles-server/). A single `docker compose up -d` downloads a world map (~120 GB), fonts, and starts serving them.

### Full style override

For complete control over the map style, provide a URL to a [MapLibre Style JSON](https://maplibre.org/maplibre-style-spec/):

```yaml
maps:
  config:
    mapStyle: 'https://your-server.example.com/style.json'
```

## CSP requirements

This app needs additional CSP rules, which it ships in the following files:

| File                                                            | Purpose                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| [`csp.yaml`](./public/csp.yaml)                                 | Always required. Allows the map rendering worker.            |
| [`csp.defaults.yaml`](./public/csp.defaults.yaml)               | Allows the default OpenStreetMap tile server.                |
| [`csp.protomaps-fonts.yaml`](./public/csp.protomaps-fonts.yaml) | Only needed for PMTiles with the default font configuration. |

If you configure a different tile server, glyph source or map style, allow those hosts in `connect-src` instead.

See [Content Security Policy](../../README.md#content-security-policy) for how to load them.

## Privacy Notice

The rendered maps are loaded from OpenStreetMap (by default). This allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser.

When using PMTiles with the default font configuration, font glyphs are loaded from `protomaps.github.io`.

Please respect the work of [OpenStreetMap](https://openstreetmap.org) and read the [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
