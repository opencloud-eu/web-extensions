# PMTiles tile server

A self-contained tile server that serves [PMTiles](https://protomaps.com/docs/pmtiles) vector tiles and the font glyphs needed for label rendering.

## Quick start

```bash
docker compose up -d
```

On first run an init container downloads a world map from [Protomaps](https://maps.protomaps.com/builds/) and fonts into `wwwroot/`, then a static file server starts at `http://localhost:9205`.

### What gets downloaded

| Asset                         | Size    | Source                                                                    |
| ----------------------------- | ------- | ------------------------------------------------------------------------- |
| World PMTiles (today's build) | ~120 GB | [protomaps.com/builds](https://maps.protomaps.com/builds/)                |
| Font glyphs (Noto Sans)       | ~14 MB  | [protomaps/basemaps-assets](https://github.com/protomaps/basemaps-assets) |

The download uses [aria2](https://aria2.github.io/) with 16 connections. If the container is stopped mid-download, the partial `.tmp` file is kept and the download **resumes automatically** on the next `docker compose up -d`.

You can also skip the download entirely by placing your own `.pmtiles` file into `wwwroot/` before starting — the script detects it and only creates the `latest.pmtiles` symlink.

## What gets served

- **PMTiles**: `http://localhost:9205/latest.pmtiles`
- **Fonts**: `http://localhost:9205/fonts/{fontstack}/{range}.pbf`

## OpenCloud configuration

### apps.yaml

Configure the maps extension to use the local tile server:

```yaml
maps:
  config:
    tileLayerUrlTemplate: 'http://localhost:9205/latest.pmtiles'
    tileLayerAttribution: '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org">OpenStreetMap</a>'
    tileLayerGlyphs: 'http://localhost:9205/fonts/{fontstack}/{range}.pbf'
```

### csp.yaml

Add `http://localhost:9205/` to the `connect-src` directive:

```yaml
directives:
  connect-src:
    - "'self'"
    - 'http://localhost:9205/'
```

After changing either file, restart OpenCloud for the new configuration to take effect.

## Updating tiles

Remove the existing tiles and restart:

```bash
rm wwwroot/*.pmtiles wwwroot/latest.pmtiles
docker compose up -d
```

This downloads a fresh build for the current day.
