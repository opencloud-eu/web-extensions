import { AppWrapperRoute, defineWebApplication } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import JsonViewer from './App.vue'
import translations from '../l10n/translations.json'

const applicationId = 'json-viewer'
export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: applicationId,
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(JsonViewer, {
          applicationId
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('JSON Viewer'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo = {
      name: $gettext('JSON Viewer'),
      id: applicationId,
      icon: 'file-code',
      defaultExtension: 'json',
      extensions: [
        {
          extension: 'json',
          routeName: 'json-viewer'
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
