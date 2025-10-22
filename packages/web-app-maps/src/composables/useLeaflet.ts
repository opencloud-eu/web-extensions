import { MapOptions } from 'leaflet'
import * as L from 'leaflet'

import iconUrl from 'leaflet-gpx/icons/pin-icon-start.png?url'
import shadowUrl from 'leaflet-gpx/icons/pin-shadow.png?url'

export type GeoCoordinates = {
  latitude: number
  longitude: number
}

export type MarkerOptions = {
  location: GeoCoordinates
  pinOptions: unknown
}

export const useLeaflet = () => {
  const createPinIcon = (options?: Partial<L.IconOptions>) => {
    return L.icon({
      iconUrl,
      shadowUrl,
      ...options
    })
  }

  const createMap = (
    applicationConfig: Record<string, any>,
    element: string | HTMLElement,
    options?: MapOptions
  ) => {
    const map = L.map(element, options)

    const urlTemplate =
      applicationConfig?.tileLayerUrlTemplate || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    const tileOptions = {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
      ...applicationConfig?.tileLayerOptions
    }

    L.tileLayer(urlTemplate, tileOptions).addTo(map)

    L.control
      .scale({
        imperial: false
      })
      .addTo(map)

    return map
  }

  return {
    createMap,
    createPinIcon
  }
}
