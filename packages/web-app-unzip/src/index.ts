import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import { defineWebApplication } from '@opencloud-eu/web-pkg'
import { useExtensions } from './composables/useExtensions'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()
    const extensions = useExtensions()

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
