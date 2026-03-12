<template>
  <div ref="mapElement" class="mapContainer ext:h-[200px]" />
</template>

<script setup lang="ts">
import { ref, unref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMap, useMapPins } from '../composables'
import { Resource } from '@opencloud-eu/web-client'

const { panelContext, applicationConfig } = defineProps<{
  panelContext: any
  applicationConfig: Record<string, any>
}>()

const { createMap } = useMap()

const mapElement = useTemplateRef('mapElement')
const mapObject = ref<maplibregl.Map>()

const resources = computed(() => {
  if (!panelContext || !panelContext.items) return []
  return (unref(panelContext.items.filter((r: Resource) => !!r.location)) || []) as Resource[]
})

const { setView } = useMapPins(resources, mapObject)

onMounted(() => {
  mapObject.value = createMap(applicationConfig, unref(mapElement)!)
  mapObject.value.on('load', () => {
    setView()
  })
})

onUnmounted(() => {
  mapObject.value?.remove()
})
</script>
