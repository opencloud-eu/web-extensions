<template>
  <div class="ext:flex ext:flex-col">
    <div ref="leafletElement" class="ext:size-full ext:z-1">
      <dl
        class="ext:absolute ext:grid ext:grid-cols-[auto_minmax(0,1fr)] ext:z-990 bg-role-surface-container ext:rounded ext:p-2 ext:right-2 ext:top-2"
      >
        <dt v-text="$gettext('Name')" />
        <dd>{{ meta.name }}</dd>

        <dt v-text="$gettext('Distance')" />
        <dd>{{ meta.distance }}km</dd>

        <dt v-text="$gettext('Elevation Gain')" />
        <dd>{{ meta.elevationGain }}m</dd>

        <dt v-text="$gettext('Elevation Loss')" />
        <dd>{{ meta.elevationLoss }}m</dd>
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount, watch, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import * as L from 'leaflet'
import { useLeaflet } from '../composables'

import startIcon from 'leaflet-gpx/icons/pin-icon-start.png?url'
import endIcon from 'leaflet-gpx/icons/pin-icon-end.png?url'
import wptIconStart from 'leaflet-gpx/icons/pin-icon-start.png?url'
import wptIconEnd from 'leaflet-gpx/icons/pin-icon-end.png?url'
import wptIcon from 'leaflet-gpx/icons/pin-icon-wpt.png?url'

const { currentContent, applicationConfig } = defineProps<{
  currentContent: string
  applicationConfig: Record<string, any>
}>()

const { createMap } = useLeaflet()
const leafletElement = ref<HTMLElement | null>(null)
const { $gettext } = useGettext()

let mapObject: L.Map | null = null
const meta = ref<{
  name?: string
  distance?: string
  elevationGain?: string
  elevationLoss?: string
  elevationNet?: string
}>({})

const gpxOptions = {
  async: true,
  marker_options: {
    clickable: false
  },
  markers: {
    startIcon,
    endIcon,
    wptIcons: {
      start: wptIconStart,
      end: wptIconEnd,
      '': wptIcon
    }
  }
}

let gpxLayer: L.GPX | null = null
const setView = () => {
  if (!mapObject) return
  if (gpxLayer) mapObject.removeLayer(gpxLayer)
  gpxLayer = new L.GPX(currentContent, gpxOptions)
    .on('loaded', (e) => {
      const gpx = e.target
      mapObject!.fitBounds(e.target.getBounds())
      meta.value = {
        name: gpx.get_name(),
        distance: gpx.get_distance_imp().toFixed(2),
        elevationGain: gpx.to_ft(gpx.get_elevation_gain()).toFixed(0),
        elevationLoss: gpx.to_ft(gpx.get_elevation_loss()).toFixed(0),
        elevationNet: gpx.to_ft(gpx.get_elevation_gain() - gpx.get_elevation_loss()).toFixed(0)
      }
    })
    .addTo(mapObject)
}

onMounted(() => {
  mapObject = createMap(applicationConfig, unref(leafletElement))
  setView()
})

watch(() => currentContent, setView)

onBeforeUnmount(() => {
  mapObject?.remove()
})
</script>
