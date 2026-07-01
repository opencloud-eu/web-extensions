<template>
  <div id="bpmn-app" class="bpmn-app">
    <div ref="canvasEl" class="bpmn-canvas" />
    <div v-if="!isReadOnly" ref="propertiesEl" class="bpmn-properties" />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
  PropType,
  shallowRef
} from 'vue'
import { Resource } from '@opencloud-eu/web-client'
import { AppConfigObject } from '@opencloud-eu/web-pkg'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import BpmnViewer from 'bpmn-js/lib/Viewer'
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule
} from 'bpmn-js-properties-panel'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css'

export default defineComponent({
  name: 'BpmnEditor',
  props: {
    resource: {
      type: Object as PropType<Resource>,
      required: true
    },
    applicationConfig: {
      type: Object as PropType<AppConfigObject>,
      required: true,
      default: (): AppConfigObject => undefined
    },
    currentContent: {
      type: String,
      required: true
    },
    isReadOnly: {
      type: Boolean,
      required: true
    },
    isDirty: {
      type: Boolean,
      required: true
    }
  },
  emits: ['update:currentContent', 'save', 'close'],
  setup(props, { emit }) {
    const canvasEl = ref<HTMLElement>()
    const propertiesEl = ref<HTMLElement>()
    const bpmnInstance = shallowRef<InstanceType<typeof BpmnModeler> | InstanceType<typeof BpmnViewer>>()

    async function importXml(xml: string) {
      const instance = bpmnInstance.value
      if (!instance || !xml) {
        return
      }

      try {
        await instance.importXML(xml)
        const canvas = instance.get('canvas') as any
        canvas.zoom('fit-viewport')
      } catch (err) {
        console.error('Failed to import BPMN XML', err)
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

    function createInstance() {
      if (props.isReadOnly) {
        return new BpmnViewer({
          container: canvasEl.value
        })
      }

      return new BpmnModeler({
        container: canvasEl.value,
        propertiesPanel: {
          parent: propertiesEl.value
        },
        additionalModules: [BpmnPropertiesPanelModule, BpmnPropertiesProviderModule]
      })
    }

    onMounted(async () => {
      const instance = createInstance()
      bpmnInstance.value = instance

      if (!props.isReadOnly) {
        instance.on('commandStack.changed', handleChange)
      }

      await importXml(props.currentContent)
    })

    onBeforeUnmount(() => {
      bpmnInstance.value?.destroy()
    })

    watch(
      () => props.resource,
      () => {
        importXml(props.currentContent)
      }
    )

    return {
      canvasEl,
      propertiesEl
    }
  }
})
</script>

<style>
.bpmn-app {
  display: flex;
  width: 100%;
  height: 100%;
}

.bpmn-canvas {
  flex: 1;
  min-height: 0;
}

.bpmn-properties {
  width: 320px;
  border-left: 1px solid #ccc;
  overflow-y: auto;
}
</style>
