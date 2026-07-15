import translations from '../l10n/translations.json'
import { AppWrapperRoute, defineWebApplication } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'

import '@opencloud-eu/extension-sdk/tailwind.css'
import App from './App.vue'
import { SUPPORTED_ROM_EXTENSIONS } from './roms'

const applicationId = 'arcade'
export default defineWebApplication({
  setup(args) {
    const { $gettext } = useGettext()

    const routes = [
      {
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, {
          applicationId
        }),
        name: 'arcade',
        meta: {
          authContext: 'hybrid',
          title: $gettext('Arcade'),
          patchCleanPath: true
        }
      }
    ]

    return {
      appInfo: {
        name: $gettext('Arcade'),
        id: applicationId,
        icon: 'game',
        iconFillType: 'fill',
        iconColor: '#ffce55',
        extensions: SUPPORTED_ROM_EXTENSIONS.map((extension) => ({
          extension,
          routeName: 'arcade'
        }))
      },
      translations,
      routes
    }
  }
})
