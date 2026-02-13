import { gpx } from '@tmcw/togeojson'

type GeoJsonResult = ReturnType<typeof gpx>
type Coord = number[]

export type GpxMetadata = {
  name: string
  distance: string
  elevationGain: string
  elevationLoss: string
}

export type GpxData = {
  geojson: GeoJsonResult
  metadata: GpxMetadata
  bounds: [number, number, number, number] // [west, south, east, north]
  startPoint: [number, number] | null // [lng, lat]
  endPoint: [number, number] | null // [lng, lat]
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineDistance(a: Coord, b: Coord): number {
  const R = 6371000 // Earth radius in meters
  const dLat = toRadians(b[1] - a[1])
  const dLng = toRadians(b[0] - a[0])
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h =
    sinLat * sinLat + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function extractCoordinates(geojson: GeoJsonResult): Coord[][] {
  const tracks: Coord[][] = []
  for (const feature of geojson.features) {
    const geom = feature.geometry
    if (geom?.type === 'LineString') {
      tracks.push(geom.coordinates)
    } else if (geom?.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        tracks.push(line)
      }
    }
  }
  return tracks
}

export function parseGpx(gpxString: string): GpxData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(gpxString, 'text/xml')
  const geojson = gpx(doc)

  const tracks = extractCoordinates(geojson)
  const allCoords = tracks.flat()

  let totalDistance = 0
  let elevationGain = 0
  let elevationLoss = 0

  for (const coords of tracks) {
    for (let i = 1; i < coords.length; i++) {
      totalDistance += haversineDistance(coords[i - 1], coords[i])
      const elevDiff = (coords[i][2] ?? 0) - (coords[i - 1][2] ?? 0)
      if (elevDiff > 0) {
        elevationGain += elevDiff
      } else {
        elevationLoss += Math.abs(elevDiff)
      }
    }
  }

  // Compute bounds [west, south, east, north]
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const coord of allCoords) {
    if (coord[0] < west) west = coord[0]
    if (coord[0] > east) east = coord[0]
    if (coord[1] < south) south = coord[1]
    if (coord[1] > north) north = coord[1]
  }
  const bounds: [number, number, number, number] = [west, south, east, north]

  const name =
    geojson.features[0]?.properties?.name || doc.querySelector('trk > name')?.textContent || ''

  const firstTrack = tracks[0]
  const lastTrack = tracks[tracks.length - 1]
  const startPoint: [number, number] | null = firstTrack
    ? [firstTrack[0][0], firstTrack[0][1]]
    : null
  const endPoint: [number, number] | null = lastTrack
    ? [lastTrack[lastTrack.length - 1][0], lastTrack[lastTrack.length - 1][1]]
    : null

  return {
    geojson,
    metadata: {
      name,
      distance: (totalDistance / 1000).toFixed(2),
      elevationGain: elevationGain.toFixed(0),
      elevationLoss: elevationLoss.toFixed(0)
    },
    bounds,
    startPoint,
    endPoint
  }
}
