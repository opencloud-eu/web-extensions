# Changelog

## [2.0.2](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v2.0.2) - 2026-03-13

### 🐛 Bug Fixes

This version is needed for compatibility with OpenCloud version >= 5.2.0.

- Fix visual representation of the maps meta overlay [[#380](https://github.com/opencloud-eu/web-extensions/pull/380)]
- Location panel rendering [[#387](https://github.com/opencloud-eu/web-extensions/pull/387)]

## [2.0.1](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v2.0.1) - 2026-02-27

### 🐛 Bug Fixes

- Map not recentering when switching between files with geodata in the sidebar panel [[#373](https://github.com/opencloud-eu/web-extensions/pull/373)]

## [2.0.0](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v2.0.0) - 2026-02-24

### Breaking changes

- `tileLayerOptions` config now reflects options of the `maplibre-gl` library and gets passed through.
- `tileLayerOptions.attribution` config is now deprecated, please use `tileLayerAttribution` instead.

### ✨ Features

- Add support for PMTiles [[#364](https://github.com/opencloud-eu/web-extensions/pull/364)]

## [1.0.2](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v1.0.2) - 2025-11-10

### 🐛 Bug Fixes

- Opening .gpx files [[#289](https://github.com/opencloud-eu/web-extensions/pull/289)]
- Pin location misbehaving [[#286](https://github.com/opencloud-eu/web-extensions/pull/286)]

## [1.0.1](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v1.0.1) - 2025-10-27

### 🐛 Bug Fixes

- Missing icons [[#262](https://github.com/opencloud-eu/web-extensions/pull/262)]
- Map folder view [[#266](https://github.com/opencloud-eu/web-extensions/pull/266)]

## [1.0.0](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v1.0.0) - 2025-10-01

### ✨ Features

- Migrate to Tailwind [[#219](https://github.com/opencloud-eu/web-extensions/pull/219)]

## [0.1.0](https://github.com/opencloud-eu/web-extensions/releases/tag/maps-v0.1.0) - 2025-08-18

### ✨ Features

- Create maps app [[#166](https://github.com/opencloud-eu/web-extensions/pull/166)]
