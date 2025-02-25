import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import { defineWebApplication } from '@opencloud-eu/web-pkg'
import { useExtensions } from './composables/useExtensions'

export default defineWebApplication({
  setup(args) {
    const { $gettext } = useGettext()
    return {
      appInfo: {
        id: 'importer',
        name: $gettext('Importer')
      },
      extensions: useExtensions(args),
      translations
    }
  }
})
