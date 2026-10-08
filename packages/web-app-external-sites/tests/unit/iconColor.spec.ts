import { fallbackIconColor } from '../../src/iconColor'

describe('fallbackIconColor', () => {
  it.each([
    ['book', '#2e71ff'],
    ['grid', '#308b46'],
    ['leaf', '#329559']
  ])('gives the icon "%s" the color the host derives for it', (icon, color) => {
    expect(fallbackIconColor(icon)).toBe(color)
  })

  it.each([
    ['key', '#01985c'],
    ['upload', '#040e01'],
    ['bell', '#2e1503']
  ])('gives the icon "%s" a color, although the host fails to derive one', (icon, color) => {
    expect(fallbackIconColor(icon)).toBe(color)
  })

  it('derives the color of a named icon from its name', () => {
    expect(fallbackIconColor({ name: 'key', fillType: 'line' })).toBe('#01985c')
  })

  it('returns nothing for an image icon, which needs no derived color', () => {
    expect(fallbackIconColor({ src: 'https://example.org/key.svg' })).toBeUndefined()
  })

  it('returns nothing without an icon', () => {
    expect(fallbackIconColor(undefined)).toBeUndefined()
  })
})
