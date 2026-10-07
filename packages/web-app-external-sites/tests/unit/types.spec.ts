import { ExternalSitesConfigSchema } from '../../src/types'

function site(icon: unknown) {
  return { name: 'Docs', url: 'https://docs.example.org', icon }
}

describe('external sites config', () => {
  it('accepts the name of an icon for a site', () => {
    const { sites } = ExternalSitesConfigSchema.parse({ sites: [site('book')] })

    expect(sites[0].icon).toBe('book')
  })

  it('accepts a named icon with a fill type and a color for a site', () => {
    const icon = { name: 'sun', fillType: 'line', color: '#ffd400' }

    const { sites } = ExternalSitesConfigSchema.parse({ sites: [site(icon)] })

    expect(sites[0].icon).toEqual(icon)
  })

  it('rejects a named icon with an unknown fill type', () => {
    expect(() =>
      ExternalSitesConfigSchema.parse({ sites: [site({ name: 'sun', fillType: 'solid' })] })
    ).toThrow()
  })

  it('rejects an icon that is a named icon and an image at once', () => {
    expect(() =>
      ExternalSitesConfigSchema.parse({ sites: [site({ name: 'sun', src: 'https://x/y.svg' })] })
    ).toThrow()
  })

  it('accepts an image icon for a site', () => {
    const icon = { src: 'https://docs.example.org/logo.svg' }

    const { sites } = ExternalSitesConfigSchema.parse({ sites: [site(icon)] })

    expect(sites[0].icon).toEqual(icon)
  })

  it('accepts an image icon with a variant for dark mode', () => {
    const icon = {
      src: 'https://docs.example.org/logo.svg',
      srcDark: 'https://docs.example.org/logo-dark.svg'
    }

    const { sites } = ExternalSitesConfigSchema.parse({ sites: [site(icon)] })

    expect(sites[0].icon).toEqual(icon)
  })

  it('accepts an image icon for a dashboard and for the sites in it', () => {
    const icon = { src: 'https://example.org/logo.svg' }

    const { dashboards } = ExternalSitesConfigSchema.parse({
      dashboards: [{ name: 'Home', icon, sites: [site(icon), { sites: [site(icon)] }] }]
    })

    expect(dashboards[0].icon).toEqual(icon)
    expect(dashboards[0].sites).toEqual([
      expect.objectContaining({ icon }),
      { sites: [expect.objectContaining({ icon })] }
    ])
  })

  it('still accepts a site without an icon', () => {
    const { sites } = ExternalSitesConfigSchema.parse({ sites: [site(undefined)] })

    expect(sites[0].icon).toBeUndefined()
  })

  it('rejects an image icon without a source', () => {
    expect(() =>
      ExternalSitesConfigSchema.parse({ sites: [site({ srcDark: 'https://x/y.svg' })] })
    ).toThrow()
  })
})
