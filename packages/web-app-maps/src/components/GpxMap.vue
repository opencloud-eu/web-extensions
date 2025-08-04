<template>
  <div style="display: flex; flex-direction: column">
    <div ref="leafletElement" class="oc-width-1-1 oc-height-1-1" />
    <div class="data-table-container">
      <table class="data-table">
        <tr>
          <th v-text="$gettext('Property')" />
          <th v-text="$gettext('Value')" />
        </tr>
        <tr>
          <td v-text="$gettext('Name')" />
          <td>{{ meta.name }}</td>
        </tr>
        <tr>
          <td v-text="$gettext('Distance')" />
          <td>{{ meta.distance }}km</td>
        </tr>
        <tr>
          <td v-text="$gettext('Elevation Gain')" />
          <td>{{ meta.elevationGain }}m</td>
        </tr>
        <tr>
          <td v-text="$gettext('Elevation Loss')" />
          <td>{{ meta.elevationLoss }}m</td>
        </tr>
      </table>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref, onBeforeUnmount, Ref } from 'vue'
import { useGettext } from 'vue3-gettext'

import * as L from 'leaflet'

import { useLeaflet } from '../composables'
import { unref, watch } from 'vue'

export default defineComponent({
  props: {
    currentContent: {
      type: String,
      required: true
    },
    applicationConfig: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const { assetsBaseUrl, createMap } = useLeaflet()
    const leafletElement = ref<HTMLElement | null>()
    const { $gettext } = useGettext()

    let mapObject: L.Map | null = null
    const meta: Ref<{
      name?: string
      distance?: string
      elevationGain?: string
      elevationLoss?: string
      elevationNet?: string
    }> = ref({})

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
      if (!mapObject) {
        return
      }
      if (gpxLayer) {
        mapObject.removeLayer(gpxLayer)
      }
      gpxLayer = new L.GPX(props.currentContent, gpxOptions)
        .on('loaded', (e) => {
          const gpx = e.target
          mapObject.fitBounds(e.target.getBounds())

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
      mapObject = createMap(props.applicationConfig, unref(leafletElement))
      setView()
    })

    watch(() => props.currentContent, setView)

    onBeforeUnmount(() => {
      mapObject.remove()
    })

    return {
      $gettext,
      leafletElement,
      meta
    }
  }
})
</script>

<style type="scss" scoped>
.data-table-container {
  flex-grow: 0;
  flex-shrink: 0;
}
.data-table {
  border-spacing: 10px;
}
</style>
