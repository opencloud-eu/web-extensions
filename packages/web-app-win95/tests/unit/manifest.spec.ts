import { describe, it, expect } from 'vitest'
import manifest from '../../src/manifest.json'

describe('web-app-win95 manifest', () => {
  it('provides the Windows 95 theme with its assets', () => {
    expect(manifest.config.themes).toHaveLength(1)

    const [theme] = manifest.config.themes
    expect(theme.theme).toBe('theme.json')
    expect(theme.styles).toContain('win95.css')
  })
})
