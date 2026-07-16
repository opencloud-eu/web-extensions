<template>
  <div id="bpmn-app" class="bpmn-app">
    <div class="bpmn-toolbar">
      <button :title="$gettext('Fit diagram to viewport')" @click="fitViewport">
        <oc-icon name="focus-3" size="small" />
        {{ $gettext('Fit') }}
      </button>
      <button :title="$gettext('Download diagram as SVG')" @click="exportSvg">
        <oc-icon name="download" size="small" />
        {{ $gettext('Export SVG') }}
      </button>
      <button
        v-if="!isReadOnly"
        :title="$gettext('Toggle properties panel')"
        :class="{ active: showProperties }"
        @click="showProperties = !showProperties"
      >
        <oc-icon name="list-settings" size="small" />
        {{ $gettext('Properties') }}
      </button>
    </div>
    <div class="bpmn-editor">
      <div ref="canvasEl" class="bpmn-canvas" />
      <div v-if="!isReadOnly && showProperties" ref="propertiesEl" class="bpmn-properties" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, useTemplateRef, watch, shallowRef, nextTick } from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { AppConfigObject } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import BpmnViewer from 'bpmn-js/lib/Viewer'
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel'
import MinimapModule from 'diagram-js-minimap'
import { emptyBpmn } from './emptyBpmn'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css'
import 'diagram-js-minimap/assets/diagram-js-minimap.css'

const { $gettext } = useGettext()

const props = defineProps<{
  resource: Resource
  applicationConfig: AppConfigObject
  currentContent: string
  isReadOnly: boolean
  isDirty: boolean
}>()

const emit = defineEmits<{
  'update:currentContent': [value: string]
  save: []
  close: []
}>()

const canvasEl = useTemplateRef<HTMLElement>('canvasEl')
const propertiesEl = useTemplateRef<HTMLElement>('propertiesEl')
const showProperties = ref(true)
const bpmnInstance = shallowRef<
  InstanceType<typeof BpmnModeler> | InstanceType<typeof BpmnViewer>
>()

async function importXml(xml: string) {
  const instance = bpmnInstance.value
  if (!instance || !xml) {
    return
  }

  try {
    await instance.importXML(xml)
    fitViewport()
  } catch (err) {
    console.error('Failed to import BPMN XML', err)
  }
}

function fitViewport() {
  const instance = bpmnInstance.value
  if (!instance) {
    return
  }

  const canvas = instance.get('canvas') as any
  canvas.zoom('fit-viewport')
}

async function exportSvg() {
  const instance = bpmnInstance.value
  if (!instance) {
    return
  }

  try {
    const { svg } = await instance.saveSVG()
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = (props.resource.name || 'diagram').replace(/\.bpmn$/, '') + '.svg'
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export SVG', err)
  }
}

async function handleChange() {
  const instance = bpmnInstance.value
  if (!instance || props.isReadOnly) {
    return
  }

  try {
    const { xml } = await (instance as InstanceType<typeof BpmnModeler>).saveXML({
      format: true
    })
    if (xml) {
      emit('update:currentContent', xml)
    }
  } catch (err) {
    console.error('Failed to save BPMN XML', err)
  }
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    emit('save')
  }
}

function createInstance() {
  if (props.isReadOnly) {
    return new BpmnViewer({
      container: canvasEl.value,
      additionalModules: [MinimapModule]
    })
  }

  return new BpmnModeler({
    container: canvasEl.value,
    propertiesPanel: {
      parent: propertiesEl.value
    },
    additionalModules: [BpmnPropertiesPanelModule, BpmnPropertiesProviderModule, MinimapModule]
  })
}

onMounted(async () => {
  const instance = createInstance()
  bpmnInstance.value = instance

  if (!props.isReadOnly) {
    instance.on('commandStack.changed', handleChange)
  }

  window.addEventListener('keydown', handleKeydown)
  await importXml(props.currentContent || emptyBpmn)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  bpmnInstance.value?.destroy()
})

watch(
  () => props.resource,
  () => {
    importXml(props.currentContent)
  }
)

watch(showProperties, async () => {
  const instance = bpmnInstance.value
  if (!instance || props.isReadOnly) {
    return
  }

  await nextTick()
  const propertiesPanel = (instance as InstanceType<typeof BpmnModeler>).get(
    'propertiesPanel'
  ) as any
  if (showProperties.value && propertiesEl.value) {
    propertiesPanel.attachTo(propertiesEl.value)
  } else {
    propertiesPanel.detach()
  }
})
</script>

<style scoped>
.bpmn-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.bpmn-editor {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Toolbar: adapts to OpenCloud theme (light + dark) */
.bpmn-toolbar {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--oc-role-outline-variant);
  background: var(--oc-role-surface-container);
  color: var(--oc-role-on-surface);
}

.bpmn-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--oc-role-outline-variant);
  border-radius: 4px;
  background: var(--oc-role-surface);
  cursor: pointer;
  font-size: 13px;
  color: var(--oc-role-on-surface);
}

.bpmn-toolbar button:hover {
  background: var(--oc-role-surface-container-high);
}

.bpmn-toolbar button.active {
  background: var(--oc-role-primary-container);
  color: var(--oc-role-on-primary-container);
  border-color: var(--oc-role-primary);
}

/*
 * Editor area: forced light.
 * bpmn-js has no dark mode — SVG elements are white-filled with black strokes.
 * color-scheme: light prevents inherited dark-mode styles from bleeding in.
 */
.bpmn-canvas {
  flex: 1;
  min-height: 0;
  background: #fff;
  color-scheme: light;
  color: #333;
}

.bpmn-properties {
  width: 320px;
  border-left: 1px solid #e0e0e0;
  overflow-y: auto;
  background: #fafafa;
  color-scheme: light;
  color: #333;
}
</style>
