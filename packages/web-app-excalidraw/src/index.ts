import { useGettext } from 'vue3-gettext'
import {
  AppWrapperRoute,
  defineWebApplication,
  type ApplicationInformation
} from '@opencloud-eu/web-pkg'
import App from './App.vue'
import { makeExcalidrawAdapter } from './adapters/excalidrawAdapter'
import translations from '../l10n/translations.json'

const applicationId = 'excalidraw'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: applicationId,
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, {
          applicationId,
          yjs: {
            makeAdapter: makeExcalidrawAdapter
          }
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('Excalidraw'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('Excalidraw'),
      id: applicationId,
      icon: 'pencil-ruler-2',
      defaultExtension: 'excalidraw',
      extensions: [
        {
          extension: 'excalidraw',
          icon: 'resource-type-graphic',
          iconFillType: 'fill',
          routeName: applicationId,
          newFileMenu: {
            menuTitle: () => $gettext('Whiteboard')
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
