import { AppWrapperRoute, defineWebApplication } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import { AppMenuItemExtension } from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import Create from './Create.vue'
import Show from './Show.vue'

const applicationId = 'pastebin'
export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: `${applicationId}-create`,
        path: '/',
        component: Create,
        meta: {
          authContext: 'hybrid',
          title: $gettext('Pastebin'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-show`,
        path: '/show/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(Show, {
          applicationId
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('Pastebin'),
          patchCleanPath: true
        }
      }
    ]

    const menuItem: AppMenuItemExtension = {
      id: `${applicationId}`,
      type: 'appMenuItem',
      label: () => $gettext('Pastebin'),
      icon: 'upload',
      path: urlJoin(applicationId),
      color: 'white'
    }

    const appInfo = {
      name: $gettext('Pastebin'),
      id: applicationId,
      icon: 'upload'
    }

    return {
      appInfo,
      routes,
      translations,
      extensions: [menuItem]
    }
  }
})
