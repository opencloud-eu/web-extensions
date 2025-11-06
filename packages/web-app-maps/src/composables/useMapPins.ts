import { ref, unref, watch, computed, Ref, ComputedRef } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import * as Leaflet from 'leaflet'
import { LatLngExpression } from 'leaflet'
import { useLeaflet } from './useLeaflet'

// FIXME: Leaflet types seem broken?!
const L = Leaflet as any

export const useMapPins = (
  resources: Ref<Resource[]> | ComputedRef<Resource[]>,
  mapObject: Ref<Leaflet.Map | null>,
  initialized: Ref<boolean>
) => {
  const { createPinIcon } = useLeaflet()

  const pinLocations = computed(() => {
    return unref(resources).map(
      (resource) => [resource.location.latitude, resource.location.longitude] as LatLngExpression
    )
  })

  const bounds = computed(() => {
    const latLngBounds = new L.LatLngBounds()
    unref(pinLocations).forEach((location) => {
      latLngBounds.extend(location)
    })
    return latLngBounds
  })

  const pinIcon = createPinIcon()
  const pins: Leaflet.Marker[] = []
  let hasSetInitialView = false

  const updatePins = () => {
    if (!initialized.value || !mapObject.value) return

    // Remove old pins
    pins.forEach((pin) => mapObject.value?.removeLayer(pin))
    pins.length = 0

    // Add new pins
    unref(pinLocations).forEach((p) => {
      pins.push(L.marker(p, { icon: pinIcon }).addTo(mapObject.value!))
    })
  }

  const setView = () => {
    if (!initialized.value || !mapObject.value) return
    mapObject.value.invalidateSize()

    updatePins()

    // Only fit bounds on initial view or when bounds actually change (new locations)
    if (!hasSetInitialView && unref(pinLocations).length > 0) {
      const maxZoom = unref(pinLocations).length > 1 ? 15 : 10
      mapObject.value.fitBounds(unref(bounds), {
        maxZoom,
        padding: [20, 20]
      })
      hasSetInitialView = true
    }
  }

  // Watch for changes in pin count - re-fit bounds when pins are added/removed
  watch(
    () => pinLocations.value.length,
    () => {
      hasSetInitialView = false
      setView()
    }
  )

  // Watch for coordinate changes - update pins without re-fitting bounds
  watch(
    pinLocations,
    (newLocations, oldLocations) => {
      // Only update pins if count stayed the same (coordinates changed)
      if (newLocations.length === oldLocations?.length) {
        updatePins()
      }
    },
    { deep: true }
  )

  return {
    pinLocations,
    bounds,
    setView,
    updatePins
  }
}
