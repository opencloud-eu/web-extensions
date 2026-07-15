# Changelog

## [2.2.0](https://github.com/opencloud-eu/web-extensions/releases/tag/arcade-v2.2.0) - 2026-07-16

### ✨ Features

- Add multi-system ROM support in Arcade for NES, SNES (`.snes`, `.smc`, `.sfc`), Game Boy (`.gb`), Game Boy Color (`.gbc`), Game Boy Advance (`.gba`), and Nintendo 64 (`.n64`, `.v64`, `.z64`).
- Migrate Arcade runtime from `nes-vue` to EmulatorJS and use one emulator flow across supported systems.

### 🐛 Bug Fixes

- Fix EmulatorJS runtime initialization by shipping and mapping all required core/decompression assets in the extension bundle.
- Fix EmulatorJS core asset lookup to use filename-based path mapping expected by loader internals.

### 📦️ Dependencies

- Replace `nes-vue` with EmulatorJS runtime/core dependencies for NES, SNES, GB/GBC, GBA, and N64.

## [2.1.0](https://github.com/opencloud-eu/web-extensions/releases/tag/arcade-v2.1.0) - 2026-07-15

### ✨ Features

- Add metadata from package.json to manifest.json [[#2894](https://github.com/opencloud-eu/web/pull/2894)]

## [2.0.0](https://github.com/opencloud-eu/web-extensions/releases/tag/arcade-v2.0.0) - 2026-04-07

### Breaking changes

- The extension is now bundled as ESM instead of AMD and only loads with OpenCloud versions >= 6.

## [1.0.0](https://github.com/opencloud-eu/web-extensions/releases/tag/arcade-v1.0.0) - 2025-10-01

### ✨ Features

- Migrate to Tailwind [[#219](https://github.com/opencloud-eu/web-extensions/pull/219)]

## [0.1.0](https://github.com/opencloud-eu/web-extensions/releases/tag/arcade-v0.1.0) - 2025-08-18

### ✨ Features

- Create arcade app [[#180](https://github.com/opencloud-eu/web-extensions/pull/180)]
