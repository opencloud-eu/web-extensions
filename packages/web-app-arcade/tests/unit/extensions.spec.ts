import { SUPPORTED_ROM_EXTENSIONS } from '../../src/roms'

describe('arcade app', () => {
  it('supports all expected ROM extensions', () => {
    expect(SUPPORTED_ROM_EXTENSIONS).toEqual(
      expect.arrayContaining(['nes', 'snes', 'smc', 'sfc', 'gb', 'gbc', 'gba', 'n64', 'v64', 'z64'])
    )
  })
})
