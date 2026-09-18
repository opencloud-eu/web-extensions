/**
 * Demo shortcut: hardcoded place names for the geohash-4 cells present in the
 * demo photo library, resolved once via Nominatim reverse geocoding of the
 * cell centers. A real implementation would reverse geocode on the fly (or
 * server-side) instead of shipping this list.
 */
const KNOWN_PLACES: Record<string, string> = {
  u1j0: 'Bonn',
  u1hu: 'Essen',
  u1hc: 'Cologne',
  u1hg: 'Düsseldorf',
  u1jh: 'Bochum',
  u1jm: 'Dortmund',
  u1hv: 'Dinslaken',
  u1x0: 'Hamburg',
  u33d: 'Berlin',
  u32n: 'Grabow (Mecklenburg)',
  u0vq: 'Koblenz',
  u0vh: 'Zell (Mosel)',
  u0uu: 'Wittlich (Eifel)',
  u0yc: 'Bad Mergentheim',
  eyt7: 'Granada',
  eyt3: 'Almuñécar',
  eyt1: 'Vélez-Málaga',
  eysx: 'Córdoba',
  eysb: 'Málaga',
  eyes: 'Seville',
  sp1f: 'Sóller (Mallorca)',
  sp44: 'Alcúdia (Mallorca)',
  sp46: 'Colònia de Sant Pere (Mallorca)',
  gc7w: 'Bray (Ireland)',
  gc7t: 'Wicklow Mountains (Ireland)'
}

export function placeName(geohash: string): string | undefined {
  return KNOWN_PLACES[geohash]
}
