import { defineWebApplication, Extension } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import NyanCat from './NyanCat.vue'
import { computed, h } from 'vue'
import translations from '../l10n/translations.json'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo = {
      name: $gettext('Progress bars'),
      id: 'progress-bars'
    }

    const nyanCatId = 'com.github.opencloud-eu.web.app.progress-bars.nyan-cat'
    const extensions = computed<Extension[]>(() => [
      {
        id: nyanCatId,
        type: 'customComponent',
        extensionPointIds: ['app.runtime.global-progress-bar'],
        content: (slots) => [h(NyanCat, slots)],
        userPreference: {
          optionLabel: $gettext('Nyan Cat progress bar')
        }
      }
    ])

    return {
      appInfo,
      extensions,
      translations
    }
  }
})
