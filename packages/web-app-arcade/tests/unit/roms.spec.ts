import { getRomExtension, getRomSystem } from '../../src/roms'

describe('arcade rom helpers', () => {
  it('maps extensions to systems', () => {
    expect(getRomSystem('/games/adventure.snes')).toBe('snes')
    expect(getRomSystem('/games/classic.sfc')).toBe('snes')
    expect(getRomSystem('/games/monster.gbc')).toBe('gb')
    expect(getRomSystem('/games/legacy.gb')).toBe('gb')
    expect(getRomSystem('/games/modern.gba')).toBe('gba')
    expect(getRomSystem('/games/original.nes')).toBe('nes')
    expect(getRomSystem('/games/mario64.z64')).toBe('n64')
    expect(getRomSystem('/games/banjo.v64')).toBe('n64')
    expect(getRomSystem('/games/starfox.n64')).toBe('n64')
  })

  it('parses extension from urls with query parameters', () => {
    expect(getRomExtension('https://example.test/game.smc?download=1')).toBe('smc')
  })

  it('returns null for unsupported files', () => {
    expect(getRomExtension('/games/readme.txt')).toBeNull()
    expect(getRomSystem('/games/readme.txt')).toBeNull()
  })
})
