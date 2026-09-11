import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import { defineWebApplication } from '@opencloud-eu/web-pkg'
import { useExtensions } from './composables/useExtensions'

export default defineWebApplication({
  setup(args) {
    const { $gettext } = useGettext()
    const extensions = useExtensions(args)

    return {
      appInfo: {
        name: $gettext('Unzip'),
        id: 'unzip'
      },
      translations,
      extensions
    }
  }
})
