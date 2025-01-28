import { Resource, urlJoin } from '@opencloud-eu/web-client'
import {
  ApplicationInformation,
  AppMenuItemExtension,
  AppWrapperRoute,
  defineWebApplication,
  useUserStore,
  useOpenEmptyEditor
} from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import App from './App.vue'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'

const applicationId = 'draw-io'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const userStore = useUserStore()
    const { openEmptyEditor } = useOpenEmptyEditor()

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

    const menuItems = computed<AppMenuItemExtension[]>(() => {
      const items: AppMenuItemExtension[] = []

      if (userStore.user) {
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
