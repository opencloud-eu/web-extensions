import { unref, watch, computed, Ref, ComputedRef } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import maplibregl from 'maplibre-gl'

export const useMapPins = (
  resources: Ref<Resource[]> | ComputedRef<Resource[]>,
  mapObject: Ref<maplibregl.Map | null>,
  initialized: Ref<boolean>
) => {
  const pinLocations = computed(() => {
    return unref(resources).map(
      (resource) => [resource.location.longitude, resource.location.latitude] as [number, number]
    )
  })

  const bounds = computed(() => {
    const lngLatBounds = new maplibregl.LngLatBounds()
    unref(pinLocations).forEach((location) => {
      lngLatBounds.extend(location)
    })
    return lngLatBounds
  })

  const pins: maplibregl.Marker[] = []
  let hasSetInitialView = false

  const updatePins = () => {
    if (!initialized.value || !mapObject.value) return

    // Remove old pins
    pins.forEach((pin) => pin.remove())
    pins.length = 0

    // Add new pins
    unref(pinLocations).forEach((p) => {
      pins.push(new maplibregl.Marker().setLngLat(p).addTo(mapObject.value!))
    })
  }

  const setView = () => {
    if (!initialized.value || !mapObject.value) return
    mapObject.value.resize()

    updatePins()

    // Only fit bounds on initial view or when bounds actually change (new locations)
    if (!hasSetInitialView && unref(pinLocations).length > 0) {
      const maxZoom = unref(pinLocations).length > 1 ? 15 : 10
      mapObject.value.fitBounds(unref(bounds), {
        maxZoom,
        padding: 20,
        animate: false
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
