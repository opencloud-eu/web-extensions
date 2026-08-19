import { Resource } from '@opencloud-eu/web-client'
import {
  ApplicationInformation,
  AppWrapperRoute,
  defineWebApplication
} from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import App from './App.vue'
import { useGettext } from 'vue3-gettext'

const applicationId = 'draw-io'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: 'draw-io',
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, {
          applicationId,
          importResourceWithExtension(resource: Resource) {
            return resource.extension === 'vsdx' ? 'drawio' : null
          }
        }),
        meta: {
          authContext: 'hybrid',
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: 'Draw.io',
      id: applicationId,
      icon: 'grid',
      color: '#EF6C00',
      defaultExtension: 'drawio',
      extensions: [
        {
          extension: 'drawio',
          routeName: 'draw-io',
          newFileMenu: {
            menuTitle() {
              return $gettext('Draw.io document')
            }
          }
        },
        {
          extension: 'vsdx',
          routeName: 'draw-io'
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
