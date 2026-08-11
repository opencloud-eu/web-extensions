import '@opencloud-eu/extension-sdk/tailwind.css'
import {
  AppMenuItemExtension,
  ApplicationInformation,
  defineWebApplication,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import PhotosDashboard from './PhotosDashboard.vue'

const applicationId = 'photos'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const userStore = useUserStore()

    const routes = [
      {
        name: applicationId,
        path: '/',
        component: PhotosDashboard,
        meta: {
          authContext: 'user' as const,
          title: $gettext('Photos'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('Photos'),
      id: applicationId,
      icon: 'image'
    }

    const menuItems = computed<AppMenuItemExtension[]>(() => {
      if (!userStore.user) return []
      return [
        {
          id: `app.${applicationId}.menuItem`,
          type: 'appMenuItem',
          label: () => $gettext('Photos'),
          icon: 'image',
          path: urlJoin(applicationId),
          color: 'white'
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
