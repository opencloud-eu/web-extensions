import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatCoordinates,
  geohashDecode,
  hashString,
  monthLabel,
  sortedMonthBuckets
} from '../../src/helpers'

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

describe('hashString', () => {
  it('is deterministic and non-negative', () => {
    expect(hashString('IMG_4021')).toBe(hashString('IMG_4021'))
    expect(hashString('IMG_4021')).toBeGreaterThanOrEqual(0)
  })
})
