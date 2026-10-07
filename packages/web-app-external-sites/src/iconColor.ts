// FIXME: remove this file, and stop passing a color for sites and dashboards that have none,
// once the app can rely on a Web that contains https://github.com/opencloud-eu/web/pull/3585.
//
// Without a color, the application icon of the host derives one from the icon name. Before
// that fix this throws while rendering for about one icon name in nine, which takes the whole
// dashboard or app menu with it. Until then the app derives the color itself, the same way the
// fixed host does, so the icons look the same once this is removed.

import { ExternalSiteIcon } from './types'

type Rgb = [number, number, number]

const WHITE: Rgb = [255, 255, 255]
const DESIRED_CONTRAST_RATIO = 4

function hashedColor(name: string): Rgb {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return [(hash >> 16) & 0xff, (hash >> 8) & 0xff, hash & 0xff]
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return Number((0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(3))
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = luminance(a)
  const lumB = luminance(b)
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05)
}

function shade(rgb: Rgb, percent: number): Rgb {
  return rgb.map((value) => Math.round(Math.min((value * (100 + percent)) / 100, 255))) as Rgb
}

function withDesiredContrast(rgb: Rgb): Rgb {
  let color = rgb
  for (;;) {
    const ratio = contrastRatio(color, WHITE)
    if (Math.abs(DESIRED_CONTRAST_RATIO - ratio) <= 0.3) {
      return color
    }
    const shaded = shade(color, ratio < DESIRED_CONTRAST_RATIO ? -1 : 1)
    if (shaded.every((value, index) => value === color[index])) {
      return color
    }
    color = shaded
  }
}

export function fallbackIconColor(icon?: ExternalSiteIcon): string | undefined {
  const name = typeof icon === 'string' ? icon : icon && 'name' in icon ? icon.name : undefined
  if (!name) {
    return undefined
  }
  const hex = withDesiredContrast(hashedColor(name))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}
