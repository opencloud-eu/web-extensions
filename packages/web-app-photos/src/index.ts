import '@opencloud-eu/extension-sdk/tailwind.css'
import './styles.css'
import {
  AppMenuItemExtension,
  AppNavigationItem,
  ApplicationInformation,
  ClassicApplicationScript,
  defineWebApplication,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import TimelineView from './TimelineView.vue'

const applicationId = 'photos'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const userStore = useUserStore()

    const routes: ClassicApplicationScript['routes'] = [
      {
        // stable entry point: what "/" shows may change, /timeline stays
        name: applicationId,
        path: '/',
        redirect: { name: `${applicationId}-timeline` }
      },
      {
        name: `${applicationId}-timeline`,
        path: '/timeline',
        component: TimelineView,
        meta: {
          authContext: 'user' as const,
          title: $gettext('Timeline'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('Photos'),
      id: applicationId,
      icon: 'image'
    }

    const navItems: AppNavigationItem[] = [
      {
        name: () => $gettext('Timeline'),
        icon: 'calendar',
        route: { name: `${applicationId}-timeline` },
        priority: 10
      }
    ]

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
      navItems,
      translations,
      extensions: menuItems
    }
  }
})
