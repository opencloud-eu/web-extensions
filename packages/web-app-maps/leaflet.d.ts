// Augmentation for @types/leaflet-gpx to fix incomplete type definitions
// The official types are missing the 'markers' property and 'clickable' in marker_options
import 'leaflet'

declare module 'leaflet' {
  interface GPXOptions {
    // The official types are missing this separate 'markers' property
    markers?: {
      startIcon?: string
      endIcon?: string
      wptIcons?: {
        [key: string]: string
      }
    }
  }

  interface GPXMarkerOptions {
    // The official types are missing 'clickable' property
    clickable?: boolean
  }
}
