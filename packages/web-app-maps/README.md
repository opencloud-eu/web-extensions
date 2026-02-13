# OpenCloud Maps

OpenCloud Maps app can display `.gpx` files and show geo location data for single pictures in the sidebar or for a whole folder as a folder view.

## Config

In `apps.yaml` you can override configuration like this:

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

### Content Security Policy

To enable seamless integration of traffic to tile servers, the Content Security Policy of OpenCloud has to be adopted.

In the file `csp.yaml`, add the tile server URL(s) to the `connect-src:` section. MapLibre also requires web workers, so `worker-src` and `child-src` must allow `blob:`:

```yaml
directives:
  worker-src:
    - "'self'"
    - 'blob:'
  child-src:
    - "'self'"
    - 'blob:'
  connect-src:
    - "'self'"
    - 'blob:'
    - 'https://tile.openstreetmap.org/'
```

When using PMTiles with the default font configuration, also add `https://protomaps.github.io/` to `connect-src`.

## Privacy Notice

The rendered maps are loaded from OpenStreetMap (by default). This allows them to do at least some basic kind of tracking, simply because files are loaded from their servers by your browser.

When using PMTiles with the default font configuration, font glyphs are loaded from `protomaps.github.io`.

Please respect the work of [OpenStreetMap](https://openstreetmap.org) and read the [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
