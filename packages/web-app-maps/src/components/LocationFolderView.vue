<template>
  <div class="ext:h-full">
    <no-content-message v-if="!pinLocations.length" icon="map-2">
      <template #message>
        <span v-text="$gettext('No files with location data')" />
      </template>
    </no-content-message>
    <div ref="leafletElement" class="ext:h-full" :class="{ hidden: !pinLocations.length }" />
  </div>
</template>

<script setup lang="ts">
import { ref, unref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useLeaflet } from '../composables'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import * as Leaflet from 'leaflet'
import { LatLngExpression } from 'leaflet'
import { useGettext } from 'vue3-gettext'

// FIXME: Leaflet types seem broken?!
const L = Leaflet as any

const { resources, applicationConfig } = defineProps<{
  resources: Resource[]
  applicationConfig: Record<string, any>
}>()

const { $gettext } = useGettext()
const { createMap, createPinIcon } = useLeaflet()
const leafletElement = ref<HTMLElement | null>(null)
const initialized = ref(false)

const resourcesWithLocation = computed(() => {
  return (unref(resources?.filter((r) => !!r.location)) || []) as Resource[]
})

const pinLocations = computed(() => {
  return unref(resourcesWithLocation).map(
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

const setView = () => {
  if (!initialized.value) return
  mapObject?.invalidateSize()
  if (unref(pinLocations).length > 0) {
    mapObject?.fitBounds(unref(bounds), { maxZoom: unref(pinLocations).length > 1 ? 15 : 10 })
  }
  pins.forEach((pin) => mapObject?.removeLayer(pin))
  pins.length = 0
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
</script>
