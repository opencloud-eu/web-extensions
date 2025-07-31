<template>
  <div ref="leafletElement" class="leafletContainer" />
</template>

<script lang="ts">
import { PropType, defineComponent, onMounted, ref, unref, watch, computed, onUnmounted } from 'vue'
import { useLeaflet } from '../composables'
import { useSideBar } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'

import * as L from 'leaflet'
import { LatLngExpression } from 'leaflet'

export default defineComponent({
  props: {
    panelContext: {
      type: Object as PropType<any>,
      required: true
    },
    applicationConfig: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const { createMap, createPinIcon } = useLeaflet()
    const leafletElement = ref<HTMLElement | null>()
    const { onPanelActive } = useSideBar()
    const initialized = ref(false)
    const resources = computed(() => {
      if (!props.panelContext || !props.panelContext.items) {
        return []
      }
      return (unref(props.panelContext.items.filter((r) => !!r.location)) || []) as Resource[]
    })
    const pinLocations = computed(() => {
      return unref(resources).map(
        (resource) =>
          [resource.location.latitude, resource.location.longitude, 1] as LatLngExpression
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
    const pins = []
    const setView = () => {
      if (!initialized.value) {
        return
      }
      mapObject?.invalidateSize()
      if (unref(pinLocations).length > 0) {
        mapObject?.fitBounds(unref(bounds), { maxZoom: unref(pinLocations).length > 1 ? 15 : 10 })
      }

      pins.forEach((pin) => mapObject.removeLayer(pin))
      unref(pinLocations).forEach((p) => {
        pins.push(L.marker(p, { icon: pinIcon }).addTo(mapObject))
      })
    }
    watch(
      () => [bounds],
      () => {
        setView()
      }
    )
    let mapObject: L.Map | null = null
    onMounted(() => {
      initialized.value = true
      mapObject = createMap(props.applicationConfig, unref(leafletElement))
      setView()
    })
    onUnmounted(() => {
      mapObject?.remove()
    })
    onPanelActive('location-details', () => {
      initialized.value = true
      setView()
    })
    return {
      leafletElement
    }
  }
})
</script>

<style lang="scss">
.leafletContainer {
  height: 200px;
}
</style>
