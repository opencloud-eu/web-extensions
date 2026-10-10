import { useGettext } from 'vue3-gettext'
import {
  AppWrapperRoute,
  defineWebApplication,
  type ApplicationInformation
} from '@opencloud-eu/web-pkg'
import App from './App.vue'
import translations from '../l10n/translations.json'

export const applicationId = 'pdf-studio'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const routes = [
      {
        name: applicationId,
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(App, {
          applicationId,
          fileContentOptions: { responseType: 'arraybuffer' }
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('PDF Studio'),
          patchCleanPath: true
        }
      }
    ]

    const appInfo: ApplicationInformation = {
      name: $gettext('PDF Studio'),
      id: applicationId,
      icon: 'file-pdf-2',
      color: '#ec0d47',
      extensions: [
        {
          extension: 'pdf',
          mimeType: 'application/pdf',
          routeName: applicationId
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
