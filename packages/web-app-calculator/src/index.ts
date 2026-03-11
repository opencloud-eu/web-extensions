import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { computed } from 'vue'
import { defineWebApplication, Extension, SearchExtension } from '@opencloud-eu/web-pkg'
import { CalculatorProvider } from './search/provider'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo = {
      name: $gettext('Calculator'),
      id: 'calculator',
      icon: 'calculator'
    }

    const extensions = computed<Extension[]>(() => [
      {
        id: 'com.github.opencloud-eu.web.calculator.search',
        extensionPointIds: ['app.search.provider'],
        type: 'search',
        searchProvider: new CalculatorProvider($gettext)
      } as SearchExtension
    ])

    return {
      appInfo,
      translations,
      extensions
    }
  }
})
