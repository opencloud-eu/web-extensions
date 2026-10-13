import { useGettext } from 'vue3-gettext'
import {
  AppWrapperRoute,
  defineWebApplication,
  type ApplicationInformation
} from '@opencloud-eu/web-pkg'
import App from './App.vue'
import { makeApollonAdapter } from './adapters/apollonAdapter'
import translations from '../l10n/translations.json'

const applicationId = 'apollon'

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
            makeAdapter: makeApollonAdapter
          }
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('Apollon'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('Apollon'),
      id: applicationId,
      icon: 'organization-chart',
      iconFillType: 'none',
      defaultExtension: 'apollon',
      extensions: [
        {
          extension: 'apollon',
          routeName: applicationId,
          newFileMenu: {
            menuTitle: () => $gettext('UML diagram')
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
