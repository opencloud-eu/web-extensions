import { urlJoin } from '@opencloud-eu/web-client'
import {
  ApplicationInformation,
  AppMenuItemExtension,
  AppWrapperRoute,
  defineWebApplication,
  useUserStore,
  useOpenEmptyEditor,
  useSpacesStore
} from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import App from './App.vue'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'

const applicationId = 'bpmn'

const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="160" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const userStore = useUserStore()
    const { openEmptyEditor } = useOpenEmptyEditor()
    const spacesStore = useSpacesStore()

    const routes = [
      {
        name: 'bpmn',
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, {
          applicationId
        }),
        meta: {
          authContext: 'hybrid',
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('BPMN Editor'),
      id: applicationId,
      icon: 'flow-chart',
      color: '#1E88E5',
      defaultExtension: 'bpmn',
      extensions: [
        {
          extension: 'bpmn',
          routeName: 'bpmn',
          newFileMenu: {
            menuTitle() {
              return $gettext('BPMN diagram')
            }
          }
        }
      ]
    }

    const menuItems = computed<AppMenuItemExtension[]>(() => {
      const items: AppMenuItemExtension[] = []

      if (userStore.user && spacesStore.personalSpace) {
        items.push({
          id: `app.${appInfo.id}.menuItem`,
          type: 'appMenuItem',
          label: () => appInfo.name,
          color: appInfo.color,
          icon: appInfo.icon,
          priority: 30,
          path: urlJoin(appInfo.id),
          handler: () => openEmptyEditor(appInfo.id, appInfo.defaultExtension)
        })
      }

      return items
    })

    return {
      appInfo,
      routes,
      translations,
      extensions: menuItems
    }
  }
})
