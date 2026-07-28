import { defineWebApplication } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'

/**
 * This app ships no UI. It only exists to provide the Windows 95 theme,
 * which it declares in src/manifest.json under `config.themes`. The web runtime
 * picks that up from external_apps[].config.themes and adds it to the theme
 * switcher; the theme's assets are served from this app's public/ directory.
 */
export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    return {
      appInfo: {
        name: $gettext('Windows 95 Theme'),
        id: 'win95'
      },
      translations
    }
  }
})
