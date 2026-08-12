import '@opencloud-eu/extension-sdk/tailwind.css'
import './styles.css'
import {
  AppMenuItemExtension,
  AppNavigationItem,
  ApplicationInformation,
  defineWebApplication,
  useRouter,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import PhotosDashboard from './PhotosDashboard.vue'
import AlbumsOverview from './AlbumsOverview.vue'
import AlbumView from './AlbumView.vue'
import AlbumEditor from './AlbumEditor.vue'

const applicationId = 'photos'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const userStore = useUserStore()
    const router = useRouter()

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
      },
      {
        name: `${applicationId}-albums`,
        path: '/albums',
        component: AlbumsOverview,
        meta: {
          authContext: 'user' as const,
          title: $gettext('Albums'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-album`,
        path: '/albums/view',
        component: AlbumView,
        meta: {
          authContext: 'user' as const,
          title: $gettext('Album'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-album-new`,
        path: '/albums/new',
        component: AlbumEditor,
        meta: {
          authContext: 'user' as const,
          title: $gettext('New album'),
          patchCleanPath: true
        }
      },
      {
        name: `${applicationId}-album-edit`,
        path: '/albums/edit',
        component: AlbumEditor,
        meta: {
          authContext: 'user' as const,
          title: $gettext('Edit album'),
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
        name: () => $gettext('Overview'),
        icon: 'dashboard',
        route: { name: applicationId },
        // the "/" route is a path prefix of every other route, so the
        // default startsWith matching would keep it always active
        isActive: () => unref(router.currentRoute).name === applicationId,
        priority: 10
      },
      {
        name: () => $gettext('Albums'),
        icon: 'gallery',
        route: { name: `${applicationId}-albums` },
        priority: 20
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
