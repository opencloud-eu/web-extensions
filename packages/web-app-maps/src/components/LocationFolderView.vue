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
import { ref, unref, computed, onMounted, onUnmounted } from 'vue'
import { useLeaflet, useMapPins } from '../composables'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import { useGettext } from 'vue3-gettext'

const { resources, applicationConfig } = defineProps<{
  resources: Resource[]
  applicationConfig: Record<string, any>
}>()

const { $gettext } = useGettext()
const { createMap } = useLeaflet()
const leafletElement = ref<HTMLElement | null>(null)
const initialized = ref(false)
const mapObject = ref<L.Map>()

const resourcesWithLocation = computed(() => {
  return (unref(resources?.filter((r) => !!r.location)) || []) as Resource[]
})

const { pinLocations, setView } = useMapPins(resourcesWithLocation, mapObject, initialized)

onMounted(() => {
  initialized.value = true
  mapObject.value = createMap(applicationConfig, unref(leafletElement))
  setView()
})

onUnmounted(() => {
  mapObject.value?.remove()
})
</script>
