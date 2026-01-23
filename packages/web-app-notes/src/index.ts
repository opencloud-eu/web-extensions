import '@opencloud-eu/extension-sdk/tailwind.css'
import {
  defineWebApplication,
  AppMenuItemExtension,
  ApplicationInformation,
  AppWrapperRoute
} from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'
import { appId, fileExtensionNotes } from './util'
import Overview from './views/Overview.vue'
import View from './views/View.vue'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: `${appId}-overview`,
        path: '/',
        component: Overview,
        meta: {
          authContext: 'hybrid'
        }
      },
      {
        name: `${appId}-view`,
        path: '/view/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(View, {
          applicationId: appId
        }),
        meta: {
          authContext: 'hybrid',
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('Notes'),
      id: appId,
      icon: 'sticky-note',
      color: 'var(--oc-color-icon-notes)',
      extensions: [
        {
          extension: fileExtensionNotes,
          type: 'folder',
          routeName: `${appId}-view`,
          newFileMenu: {
            menuTitle() {
              return $gettext('Notebook')
            }
          }
        }
      ]
    }

    const menuItems = computed<AppMenuItemExtension[]>(() => {
      return [
        {
          id: `app.${appInfo.id}.menuItem`,
          type: 'appMenuItem',
          label: () => appInfo.name,
          color: appInfo.color,
          icon: appInfo.icon,
          priority: 20,
          path: urlJoin(appInfo.id)
        }
      ]
    })

    return {
      appInfo,
      routes,
      translations,
      extensions: menuItems
    }
  }
})
