import {
  ApplicationInformation,
  AppWrapperRoute,
  defineWebApplication
} from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import App from './App.vue'
import { useGettext } from 'vue3-gettext'

const applicationId = 'bpmn'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

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

    return {
      appInfo,
      routes,
      translations
    }
  }
})
