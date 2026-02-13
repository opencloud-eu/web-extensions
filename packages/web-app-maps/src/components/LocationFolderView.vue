<template>
  <div class="ext:h-full">
    <no-content-message v-if="!pinLocations.length" icon="map-2">
      <template #message>
        <span v-text="$gettext('No files with location data')" />
      </template>
    </no-content-message>
    <div ref="mapElement" class="ext:h-full" :class="{ hidden: !pinLocations.length }" />
  </div>
</template>

<script setup lang="ts">
import { ref, unref, computed, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import { useMap, useMapPins } from '../composables'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import { useGettext } from 'vue3-gettext'

const { resources, applicationConfig } = defineProps<{
  resources: Resource[]
  applicationConfig: Record<string, any>
}>()

const { $gettext } = useGettext()
const { createMap } = useMap()
const mapElement = ref<HTMLElement | null>(null)
const initialized = ref(false)
const mapObject = ref<maplibregl.Map>()

const resourcesWithLocation = computed(() => {
  return (unref(resources?.filter((r) => !!r.location)) || []) as Resource[]
})

const { pinLocations, setView } = useMapPins(resourcesWithLocation, mapObject, initialized)

onMounted(() => {
  initialized.value = true
  mapObject.value = createMap(applicationConfig, unref(mapElement)!)
  mapObject.value.on('load', () => {
    setView()
  })
})

onUnmounted(() => {
  mapObject.value?.remove()
})
</script>
