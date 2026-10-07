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
      icon: 'excalidraw',
      iconFillType: 'fill',
      color: '#6965db',
      defaultExtension: 'excalidraw',
      extensions: [
        {
          extension: 'excalidraw',
          // An absolute URL renders as a colored image in the "Open with" menu,
          // like the app provider icons. The file list and the "New" menu keep
          // Web's whiteboard file type icon.
          icon: new URL('./assets/excalidraw-logo.svg', import.meta.url).href,
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
