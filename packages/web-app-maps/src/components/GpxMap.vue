<template>
  <div class="ext:flex ext:flex-col">
    <div ref="mapElement" class="ext:size-full ext:z-1">
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
import maplibregl from 'maplibre-gl'
import { useMap } from '../composables'
import { parseGpx, type GpxMetadata } from '../helpers/gpx'

const { currentContent, applicationConfig } = defineProps<{
  currentContent: string
  applicationConfig: Record<string, any>
}>()

const { createMap } = useMap()
const mapElement = ref<HTMLElement | null>(null)
const { $gettext } = useGettext()

let mapObject: maplibregl.Map | null = null
const meta = ref<Partial<GpxMetadata>>({})
const markers: maplibregl.Marker[] = []

const GPX_SOURCE = 'gpx-track'
const GPX_LAYER = 'gpx-track-line'

const setView = () => {
  if (!mapObject) return

  const { geojson, metadata, bounds, startPoint, endPoint } = parseGpx(currentContent)
  meta.value = metadata

  const addTrack = () => {
    // Remove existing source/layer if present
    if (mapObject!.getLayer(GPX_LAYER)) {
      mapObject!.removeLayer(GPX_LAYER)
    }
    if (mapObject!.getSource(GPX_SOURCE)) {
      mapObject!.removeSource(GPX_SOURCE)
    }

    // Remove existing markers
    markers.forEach((m) => m.remove())
    markers.length = 0

    mapObject!.addSource(GPX_SOURCE, {
      type: 'geojson',
      data: geojson
    })

    mapObject!.addLayer({
      id: GPX_LAYER,
      type: 'line',
      source: GPX_SOURCE,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 3
      }
    })

    // Add start marker (green)
    if (startPoint) {
      markers.push(
        new maplibregl.Marker({ color: '#22c55e' }).setLngLat(startPoint).addTo(mapObject!)
      )
    }

    // Add end marker (red)
    if (endPoint) {
      markers.push(
        new maplibregl.Marker({ color: '#ef4444' }).setLngLat(endPoint).addTo(mapObject!)
      )
    }

    // Fit map to track bounds
    mapObject!.fitBounds(bounds, { padding: 40, animate: false })
  }

  if (mapObject.isStyleLoaded()) {
    addTrack()
  } else {
    mapObject.once('load', addTrack)
  }
}

onMounted(() => {
  mapObject = createMap(applicationConfig, unref(mapElement)!)
  setView()
})

watch(() => currentContent, setView)

onBeforeUnmount(() => {
  markers.forEach((m) => m.remove())
  mapObject?.remove()
})
</script>
