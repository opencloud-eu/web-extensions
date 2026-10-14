<template>
  <dl class="ext:m-0 ext:grid ext:grid-cols-2 ext:gap-4">
    <div
      v-for="fact in facts"
      :key="fact.option.field"
      class="ext:min-w-0 ext:rounded-lg ext:bg-role-surface-container ext:px-3.5 ext:py-3"
    >
      <dt class="ext:text-xs ext:text-role-on-surface-variant">{{ title(fact) }}</dt>
      <dd
        class="ext:m-0 ext:mt-1 ext:font-mono ext:text-lg ext:tabular-nums ext:text-role-on-surface"
      >
        {{ display(fact) }}
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import { useGettext } from 'vue3-gettext'
import { ExifFact } from '../composables/usePhotoLibrary'

const { facts } = defineProps<{ facts: ExifFact[] }>()

const { $gettext } = useGettext()

function title(fact: ExifFact): string {
  switch (fact.label) {
    case 'focalLength':
      return $gettext('Focal length')
    case 'fNumber':
      return $gettext('Aperture')
    case 'iso':
      return $gettext('ISO')
    case 'imageWidth':
      return $gettext('Image width')
  }
}

function display(fact: ExifFact): string {
  switch (fact.label) {
    case 'focalLength':
      return `${fact.value.toFixed(1)} mm`
    case 'fNumber':
      return `f/${fact.value.toFixed(1)}`
    case 'iso':
      return String(Math.round(fact.value))
    case 'imageWidth':
      return `${Math.round(fact.value)} px`
  }
}
</script>
