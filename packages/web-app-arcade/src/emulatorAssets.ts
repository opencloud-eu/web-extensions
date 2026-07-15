import type { ArcadeSystem } from './roms'

import loaderUrl from '@emulatorjs/emulatorjs/data/loader.js?url'
import gameManagerUrl from '@emulatorjs/emulatorjs/data/src/GameManager.js?url'
import compressionUrl from '@emulatorjs/emulatorjs/data/src/compression.js?url'
import emulatorUrl from '@emulatorjs/emulatorjs/data/src/emulator.js?url'
import gamepadUrl from '@emulatorjs/emulatorjs/data/src/gamepad.js?url'
import nipplejsUrl from '@emulatorjs/emulatorjs/data/src/nipplejs.js?url'
import shadersUrl from '@emulatorjs/emulatorjs/data/src/shaders.js?url'
import socketIoUrl from '@emulatorjs/emulatorjs/data/src/socket.io.min.js?url'
import storageUrl from '@emulatorjs/emulatorjs/data/src/storage.js?url'
import emulatorCssUrl from '@emulatorjs/emulatorjs/data/emulator.css?url'
import extract7zUrl from '@emulatorjs/emulatorjs/data/compression/extract7z.js?url'
import extractZipUrl from '@emulatorjs/emulatorjs/data/compression/extractzip.js?url'
import libunrarJsUrl from '@emulatorjs/emulatorjs/data/compression/libunrar.js?url'
import libunrarWasmUrl from '@emulatorjs/emulatorjs/data/compression/libunrar.wasm?url'
import fceummLegacyWasmDataUrl from '@emulatorjs/core-fceumm/fceumm-legacy-wasm.data?url'
import fceummThreadLegacyWasmDataUrl from '@emulatorjs/core-fceumm/fceumm-thread-legacy-wasm.data?url'
import fceummThreadWasmDataUrl from '@emulatorjs/core-fceumm/fceumm-thread-wasm.data?url'
import fceummWasmDataUrl from '@emulatorjs/core-fceumm/fceumm-wasm.data?url'
import gambatteLegacyWasmDataUrl from '@emulatorjs/core-gambatte/gambatte-legacy-wasm.data?url'
import gambatteThreadLegacyWasmDataUrl from '@emulatorjs/core-gambatte/gambatte-thread-legacy-wasm.data?url'
import gambatteThreadWasmDataUrl from '@emulatorjs/core-gambatte/gambatte-thread-wasm.data?url'
import gambatteWasmDataUrl from '@emulatorjs/core-gambatte/gambatte-wasm.data?url'
import mgbaLegacyWasmDataUrl from '@emulatorjs/core-mgba/mgba-legacy-wasm.data?url'
import mgbaThreadLegacyWasmDataUrl from '@emulatorjs/core-mgba/mgba-thread-legacy-wasm.data?url'
import mgbaThreadWasmDataUrl from '@emulatorjs/core-mgba/mgba-thread-wasm.data?url'
import mgbaWasmDataUrl from '@emulatorjs/core-mgba/mgba-wasm.data?url'
import mupen64plusNextLegacyWasmDataUrl from '@emulatorjs/core-mupen64plus_next/mupen64plus_next-legacy-wasm.data?url'
import mupen64plusNextThreadLegacyWasmDataUrl from '@emulatorjs/core-mupen64plus_next/mupen64plus_next-thread-legacy-wasm.data?url'
import mupen64plusNextThreadWasmDataUrl from '@emulatorjs/core-mupen64plus_next/mupen64plus_next-thread-wasm.data?url'
import mupen64plusNextWasmDataUrl from '@emulatorjs/core-mupen64plus_next/mupen64plus_next-wasm.data?url'
import snes9xLegacyWasmDataUrl from '@emulatorjs/core-snes9x/snes9x-legacy-wasm.data?url'
import snes9xThreadLegacyWasmDataUrl from '@emulatorjs/core-snes9x/snes9x-thread-legacy-wasm.data?url'
import snes9xThreadWasmDataUrl from '@emulatorjs/core-snes9x/snes9x-thread-wasm.data?url'
import snes9xWasmDataUrl from '@emulatorjs/core-snes9x/snes9x-wasm.data?url'

const EMULATOR_PATHS: Record<string, string> = {
  'emulator.js': emulatorUrl,
  'nipplejs.js': nipplejsUrl,
  'shaders.js': shadersUrl,
  'storage.js': storageUrl,
  'gamepad.js': gamepadUrl,
  'GameManager.js': gameManagerUrl,
  'socket.io.min.js': socketIoUrl,
  'compression.js': compressionUrl,
  'emulator.css': emulatorCssUrl,
  'extract7z.js': extract7zUrl,
  'extractzip.js': extractZipUrl,
  'libunrar.js': libunrarJsUrl,
  'libunrar.wasm': libunrarWasmUrl,
  'fceumm-legacy-wasm.data': fceummLegacyWasmDataUrl,
  'fceumm-thread-legacy-wasm.data': fceummThreadLegacyWasmDataUrl,
  'fceumm-thread-wasm.data': fceummThreadWasmDataUrl,
  'fceumm-wasm.data': fceummWasmDataUrl,
  'gambatte-legacy-wasm.data': gambatteLegacyWasmDataUrl,
  'gambatte-thread-legacy-wasm.data': gambatteThreadLegacyWasmDataUrl,
  'gambatte-thread-wasm.data': gambatteThreadWasmDataUrl,
  'gambatte-wasm.data': gambatteWasmDataUrl,
  'mgba-legacy-wasm.data': mgbaLegacyWasmDataUrl,
  'mgba-thread-legacy-wasm.data': mgbaThreadLegacyWasmDataUrl,
  'mgba-thread-wasm.data': mgbaThreadWasmDataUrl,
  'mgba-wasm.data': mgbaWasmDataUrl,
  'mupen64plus_next-legacy-wasm.data': mupen64plusNextLegacyWasmDataUrl,
  'mupen64plus_next-thread-legacy-wasm.data': mupen64plusNextThreadLegacyWasmDataUrl,
  'mupen64plus_next-thread-wasm.data': mupen64plusNextThreadWasmDataUrl,
  'mupen64plus_next-wasm.data': mupen64plusNextWasmDataUrl,
  'snes9x-legacy-wasm.data': snes9xLegacyWasmDataUrl,
  'snes9x-thread-legacy-wasm.data': snes9xThreadLegacyWasmDataUrl,
  'snes9x-thread-wasm.data': snes9xThreadWasmDataUrl,
  'snes9x-wasm.data': snes9xWasmDataUrl
}

const EMULATOR_CORE_BY_SYSTEM: Record<ArcadeSystem, string> = {
  nes: 'nes',
  gb: 'gb',
  gba: 'gba',
  snes: 'snes',
  n64: 'n64'
}

export const getLoaderUrl = (): string => loaderUrl

export const getCoreName = (system: ArcadeSystem): string => EMULATOR_CORE_BY_SYSTEM[system]

export const getEmulatorPaths = (): Record<string, string> => EMULATOR_PATHS
