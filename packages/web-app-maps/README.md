# OpenCloud Maps

OpenCloud Maps app can display `.gpx` files and show geo location data for single pictures in the sidebar or for a whole folder as a folder view.

## Location data

The sidebar panel and the folder view use the location stored on each file, which WebDAV returns as `oc:location`. The app does not read EXIF data itself. OpenCloud's search service stores the location when it extracts a file's metadata, and only its Tika extractor reads GPS data. With the default extractor (`basic`), pictures never get a location and the folder view shows "No files with location data".

To enable it, point the search service to an [Apache Tika](https://tika.apache.org/) server:

```yaml
SEARCH_EXTRACTOR_TYPE: tika
SEARCH_EXTRACTOR_TIKA_TIKA_URL: http://tika:9998
```

In [opencloud-compose](https://github.com/opencloud-eu/opencloud-compose) this is what `search/tika.yml` adds.

Files uploaded after that get their location within seconds. Files that were indexed before keep none, because unchanged files are skipped when the index is rebuilt, so force a rescan:

```bash
opencloud search index --all-spaces --force-rescan --insecure
```

`--insecure` is needed when the internal gRPC services run without TLS, which is the default. The search service only extracts metadata from files up to 20 MiB by default (`SEARCH_CONTENT_EXTRACTION_SIZE_LIMIT`, in bytes), so larger pictures get no location.

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
