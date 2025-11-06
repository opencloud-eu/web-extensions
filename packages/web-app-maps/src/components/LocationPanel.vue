<template>
  <div ref="leafletElement" class="leafletContainer ext:h-[200px]" />
</template>

<script setup lang="ts">
import { ref, unref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useLeaflet } from '../composables'
import { useSideBar } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import * as Leaflet from 'leaflet'
import { LatLngExpression } from 'leaflet'

// FIXME: Leaflet types seem broken?!
const L = Leaflet as any

const { panelContext, applicationConfig } = defineProps<{
  panelContext: any
  applicationConfig: Record<string, any>
}>()

const { createMap, createPinIcon } = useLeaflet()
const { onPanelActive } = useSideBar()

const leafletElement = ref<HTMLElement | null>(null)
const initialized = ref(false)

const resources = computed(() => {
  if (!panelContext || !panelContext.items) return []
  return (unref(panelContext.items.filter((r: Resource) => !!r.location)) || []) as Resource[]
})

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
const pins: L.Marker[] = []
let mapObject: L.Map | null = null
let hasSetInitialView = false

const updatePins = () => {
  if (!initialized.value || !mapObject) return

  // Remove old pins
  pins.forEach((pin) => mapObject?.removeLayer(pin))
  pins.length = 0

  // Add new pins
  unref(pinLocations).forEach((p) => {
    pins.push(L.marker(p, { icon: pinIcon }).addTo(mapObject!))
  })
}

const setView = () => {
  if (!initialized.value || !mapObject) return
  mapObject.invalidateSize()

  updatePins()

  // Only fit bounds on initial view or when bounds actually change (new locations)
  if (!hasSetInitialView && unref(pinLocations).length > 0) {
    const maxZoom = unref(pinLocations).length > 1 ? 15 : 10
    mapObject.fitBounds(unref(bounds), {
      maxZoom,
      padding: [20, 20]
    })
    hasSetInitialView = true
  }
}

watch(() => [pinLocations.value.length], () => {
  // Reset flag when number of pins changes to re-fit bounds
  hasSetInitialView = false
  setView()
})

onMounted(() => {
  initialized.value = true
  mapObject = createMap(applicationConfig, unref(leafletElement))
  setView()
})

onUnmounted(() => {
  mapObject?.remove()
})

onPanelActive('location-details', () => {
  initialized.value = true
  setView()
})
</script>
