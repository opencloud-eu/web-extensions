import '@opencloud-eu/extension-sdk/tailwind.css'
import 'highlight.js/styles/github.css'
import {
  AppMenuItemExtension,
  AppWrapperRoute,
  ApplicationInformation,
  defineWebApplication
} from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import Create from './Create.vue'
import Edit from './Edit.vue'
import List from './List.vue'
import View from './View.vue'

const applicationId = 'pastebin'
const fileExtension = 'ocpb'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: `${applicationId}-create`,
        path: '/',
        component: Create,
        meta: {
          authContext: 'user',
          title: $gettext('Pastebin'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-list`,
        path: '/list',
        component: List,
        meta: {
          authContext: 'user',
          title: $gettext('Pastebins'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-view`,
        path: '/view/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(View, { applicationId }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('Pastebin'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-edit`,
        path: '/edit/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(Edit, { applicationId }),
        meta: {
          authContext: 'user',
          title: $gettext('Edit Pastebin'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('Pastebin'),
      id: applicationId,
      icon: 'upload',
      extensions: [
        {
          extension: fileExtension,
          type: 'folder',
          routeName: `${applicationId}-view`
        }
      ]
    }

    const menuItems = computed<AppMenuItemExtension[]>(() => [
      {
        id: `app.${applicationId}.menuItem`,
        type: 'appMenuItem',
        label: () => $gettext('Pastebin'),
        icon: 'upload',
        path: urlJoin(applicationId),
        color: 'white'
      }
    ])

    return {
      appInfo,
      routes,
      translations,
      extensions: menuItems
    }
  }
})
