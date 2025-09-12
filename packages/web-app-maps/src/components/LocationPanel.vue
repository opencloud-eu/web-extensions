<template>
  <div ref="leafletElement" class="leafletContainer" />
</template>

<script setup lang="ts">
import { ref, unref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useLeaflet } from '../composables'
import { useSideBar } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import * as L from 'leaflet'
import { LatLngExpression } from 'leaflet'

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
    (resource) => [resource.location.latitude, resource.location.longitude, 1] as LatLngExpression
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

const setView = () => {
  if (!initialized.value) return
  mapObject?.invalidateSize()
  if (unref(pinLocations).length > 0) {
    mapObject?.fitBounds(unref(bounds), { maxZoom: unref(pinLocations).length > 1 ? 15 : 10 })
  }
  pins.forEach((pin) => mapObject?.removeLayer(pin))
  unref(pinLocations).forEach((p) => {
    pins.push(L.marker(p, { icon: pinIcon }).addTo(mapObject!))
  })
}

watch(() => [bounds], setView)

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

<style lang="scss">
.leafletContainer {
  height: 200px;
}
</style>
