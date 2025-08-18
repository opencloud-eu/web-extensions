<template>
  <div class="oc-flex oc-flex-column">
    <div ref="leafletElement" class="oc-width-1-1 oc-height-1-1">
      <dl class="data-list">
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

const { currentContent, applicationConfig } = defineProps<{
  currentContent: string
  applicationConfig: Record<string, any>
}>()

const { assetsBaseUrl, createMap } = useLeaflet()
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
    startIcon: `${assetsBaseUrl}/pin-icon-start.png`,
    endIcon: `${assetsBaseUrl}/pin-icon-end.png`,
    wptIcons: {
      start: `${assetsBaseUrl}/pin-icon-start.png`,
      end: `${assetsBaseUrl}/pin-icon-end.png`,
      '': `${assetsBaseUrl}/pin-icon-wpt.png`
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

<style type="scss" scoped>
.leaflet-container {
  z-index: 1;
}

.data-list {
  position: absolute;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  z-index: 999;
  background: #fffc;
  border-radius: 2px;
  padding: var(--oc-space-small);
  right: 10px;
}
</style>
