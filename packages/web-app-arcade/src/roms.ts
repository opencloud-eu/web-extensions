export const ROM_SYSTEM_BY_EXTENSION = {
  nes: 'nes',
  snes: 'snes',
  smc: 'snes',
  sfc: 'snes',
  gb: 'gb',
  gbc: 'gb',
  gba: 'gba',
  n64: 'n64',
  v64: 'n64',
  z64: 'n64'
} as const

export type ArcadeSystem = (typeof ROM_SYSTEM_BY_EXTENSION)[keyof typeof ROM_SYSTEM_BY_EXTENSION]
export const SUPPORTED_ROM_EXTENSIONS = Object.keys(ROM_SYSTEM_BY_EXTENSION)

export const getRomExtension = (url: string): keyof typeof ROM_SYSTEM_BY_EXTENSION | null => {
  const fallbackPath = url.split('?')[0]
  const pathname = parsePathname(url) || fallbackPath
  const extension = pathname.split('.').at(-1)?.toLowerCase()

  if (!extension || !(extension in ROM_SYSTEM_BY_EXTENSION)) {
    return null
  }

  return extension as keyof typeof ROM_SYSTEM_BY_EXTENSION
}

export const getRomSystem = (url: string): ArcadeSystem | null => {
  const extension = getRomExtension(url)

  if (!extension) {
    return null
  }

  return ROM_SYSTEM_BY_EXTENSION[extension]
}

const parsePathname = (url: string): string | null => {
  try {
    return new URL(url, window.location.origin).pathname
  } catch {
    return null
  }
}
