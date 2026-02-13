import maplibregl from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { layers, LIGHT } from '@protomaps/basemaps'

export type GeoCoordinates = {
  latitude: number
  longitude: number
}

let pmtilesRegistered = false

export const useMap = () => {
  const createMap = (
    applicationConfig: Record<string, any>,
    container: HTMLElement
  ): maplibregl.Map => {
    // Full style override takes precedence
    const mapStyle = applicationConfig?.mapStyle
    if (mapStyle) {
      const map = new maplibregl.Map({ container, style: mapStyle })
      addControls(map)
      return map
    }

    const urlTemplate =
      applicationConfig?.tileLayerUrlTemplate || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

    const attribution = applicationConfig?.tileLayerAttribution

    if (urlTemplate.includes('.pmtiles')) {
      const glyphs = applicationConfig?.tileLayerGlyphs ||
        'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf'
      return createPmtilesMap(container, urlTemplate, glyphs, attribution)
    }

    return createRasterMap(container, urlTemplate, applicationConfig?.tileLayerOptions, attribution)
  }

  const createRasterMap = (
    container: HTMLElement,
    urlTemplate: string,
    tileLayerOptions?: Record<string, any>,
    attribution?: string
  ): maplibregl.Map => {
    const maxZoom = tileLayerOptions?.maxZoom ?? 19

    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [urlTemplate],
            tileSize: 256,
            attribution: attribution ?? '<a href="https://openstreetmap.org">OpenStreetMap</a>'
          }
        },
        layers: [
          {
            id: 'raster-layer',
            type: 'raster',
            source: 'raster-tiles'
          }
        ]
      },
      maxZoom
    })

    addControls(map)
    return map
  }

  const createPmtilesMap = (
    container: HTMLElement,
    url: string,
    glyphs: string,
    attribution?: string
  ): maplibregl.Map => {
    if (!pmtilesRegistered) {
      const protocol = new Protocol()
      maplibregl.addProtocol('pmtiles', protocol.tile)
      pmtilesRegistered = true
    }

    const sourceName = 'protomaps'
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        glyphs,
        sources: {
          [sourceName]: {
            type: 'vector',
            url: `pmtiles://${url}`,
            ...(attribution && { attribution })
          }
        },
        layers: layers(sourceName, LIGHT)
      }
    })

    addControls(map)
    return map
  }

  const addControls = (map: maplibregl.Map) => {
    map.addControl(new maplibregl.NavigationControl(), 'top-left')
    map.addControl(
      new maplibregl.ScaleControl({ unit: 'metric' }),
      'bottom-left'
    )
  }

  return { createMap }
}
