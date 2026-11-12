import { describe, expect, it } from 'vitest'
import {
  dayRange,
  formatBytes,
  formatCoordinates,
  formatTileTime,
  geohashDecode,
  groupPhotosByDay,
  hashString,
  monthLabel,
  monthRange,
  sortedMonthBuckets,
  wallClock
} from '../../src/helpers'
import { Photo } from '../../src/types'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1500, '1.5 KB'],
    [468_223_000_000, '468 GB'],
    [1_200_000_000_000, '1.2 TB']
  ])('formats %d as %s', (bytes, expected) => {
    expect(formatBytes(bytes, 'en')).toBe(expected)
  })
})

describe('sortedMonthBuckets', () => {
  it('sorts buckets chronologically by key', () => {
    const aggregation = {
      buckets: [
        { key: '2026-01', count: 1 },
        { key: '2025-11', count: 2 },
        { key: '2025-02', count: 3 }
      ]
    }
    expect(sortedMonthBuckets(aggregation).map((b) => b.key)).toEqual([
      '2025-02',
      '2025-11',
      '2026-01'
    ])
  })

  it('returns an empty array without buckets', () => {
    expect(sortedMonthBuckets({})).toEqual([])
  })
})

describe('monthLabel', () => {
  it('formats a month key', () => {
    expect(monthLabel('2026-07', 'en')).toBe('Jul')
  })

  it('includes the year when requested', () => {
    expect(monthLabel('2026-01', 'en', true)).toContain('2026')
  })
})

describe('geohashDecode', () => {
  it('decodes a known geohash to its center', () => {
    const { latitude, longitude } = geohashDecode('u4pruydqqvj')
    expect(latitude).toBeCloseTo(57.64911, 4)
    expect(longitude).toBeCloseTo(10.40744, 4)
  })

  it('decodes coarse cells to plausible centers', () => {
    const { latitude, longitude } = geohashDecode('u1j0')
    expect(latitude).toBeGreaterThan(50)
    expect(latitude).toBeLessThan(52)
    expect(longitude).toBeGreaterThan(6)
    expect(longitude).toBeLessThan(8)
  })
})

describe('formatCoordinates', () => {
  it('formats hemispheres', () => {
    expect(formatCoordinates(50.94, 6.96)).toBe('50.94° N, 6.96° E')
    expect(formatCoordinates(-33.86, -70.66)).toBe('33.86° S, 70.66° W')
  })
})

describe('wallClock', () => {
  it('treats the timestamp as wall time, ignoring the Z suffix', () => {
    const date = wallClock('2018-08-18T21:30:05Z')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2018, 7, 18])
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([21, 30, 5])
  })

  it('defaults a missing time part to midnight', () => {
    const date = wallClock('2018-08-18')
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0])
  })
})

describe('monthRange', () => {
  it('spans the first of the month to the first of the next', () => {
    expect(monthRange(2026, 7)).toEqual({ from: '2026-07-01', to: '2026-08-01' })
  })

  it('rolls over the year end', () => {
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })

  it('normalizes out-of-range months', () => {
    expect(monthRange(2026, 0)).toEqual({ from: '2025-12-01', to: '2026-01-01' })
  })
})

describe('dayRange', () => {
  it('spans a single day', () => {
    expect(dayRange(2026, 8, 17)).toEqual({ from: '2026-08-17', to: '2026-08-18' })
  })

  it('rolls over the month end', () => {
    expect(dayRange(2026, 2, 28)).toEqual({ from: '2026-02-28', to: '2026-03-01' })
  })
})

describe('groupPhotosByDay', () => {
  const photo = (id: string, takenDateTime: string) => ({ id, takenDateTime }) as Photo

  it('groups consecutive photos by the date part', () => {
    const groups = groupPhotosByDay([
      photo('a', '2026-08-17T23:59:00Z'),
      photo('b', '2026-08-17T00:01:00Z'),
      photo('c', '2026-08-16T12:00:00Z')
    ])
    expect(groups.map((g) => [g.day, g.photos.length])).toEqual([
      ['2026-08-17', 2],
      ['2026-08-16', 1]
    ])
  })
})

describe('formatTileTime', () => {
  it('formats the wall time', () => {
    expect(formatTileTime('2026-07-03T15:33:26Z', 'de')).toBe('15:33')
  })

  it('returns an empty label for malformed dates instead of throwing', () => {
    expect(formatTileTime('garbage', 'en')).toBe('')
  })
})

describe('hashString', () => {
  it('is deterministic and non-negative', () => {
    expect(hashString('IMG_4021')).toBe(hashString('IMG_4021'))
    expect(hashString('IMG_4021')).toBeGreaterThanOrEqual(0)
  })
})
