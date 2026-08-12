import { describe, expect, it } from 'vitest'
import { albumTitle, isReadOnlyVersion, parseAlbumFile, serializeAlbumFile } from '../../src/albums'
import { normalizeParentPath } from '../../src/helpers'

describe('parseAlbumFile', () => {
  it('parses a valid album file', () => {
    const file = parseAlbumFile('{"version": 1, "query": "mediatype:image"}')
    expect(file.version).toBe(1)
    expect(file.query).toBe('mediatype:image')
  })

  it.each([
    ['[]', 'array'],
    ['"x"', 'string'],
    ['{"query": "x"}', 'missing version'],
    ['{"version": 1}', 'missing query'],
    ['{"version": "1", "query": "x"}', 'non-numeric version']
  ])('rejects %s (%s)', (content) => {
    expect(() => parseAlbumFile(content)).toThrow()
  })

  it('keeps unknown fields', () => {
    const file = parseAlbumFile('{"version": 1, "query": "x", "cover": "a.jpg"}')
    expect(file.cover).toBe('a.jpg')
  })
})

describe('serializeAlbumFile', () => {
  it('round-trips unknown fields', () => {
    const original = parseAlbumFile('{"version": 1, "query": "x", "future": {"a": 1}}')
    const roundTripped = parseAlbumFile(serializeAlbumFile({ ...original, query: 'y' }))
    expect(roundTripped.query).toBe('y')
    expect(roundTripped.future).toEqual({ a: 1 })
  })
})

describe('isReadOnlyVersion', () => {
  it('marks higher versions read-only', () => {
    expect(isReadOnlyVersion({ version: 1, query: '' })).toBe(false)
    expect(isReadOnlyVersion({ version: 2, query: '' })).toBe(true)
  })
})

describe('albumTitle', () => {
  it('strips the extension', () => {
    expect(albumTitle('Festival Season.album')).toBe('Festival Season')
    expect(albumTitle('dots.in.name.album')).toBe('dots.in.name')
  })
})

describe('normalizeParentPath', () => {
  it.each([
    [undefined, ''],
    ['.', ''],
    ['./', ''],
    ['./foo/bar', 'foo/bar'],
    ['.space/photos/albums', '.space/photos/albums'],
    ['2019-12 - Weihnachten', '2019-12 - Weihnachten']
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeParentPath(input)).toBe(expected)
  })
})
