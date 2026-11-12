import { computed, markRaw, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import {
  AppWrapperRoute,
  defineWebApplication,
  type ApplicationInformation,
  type SidebarPanelExtension
} from '@opencloud-eu/web-pkg'
import App from './App.vue'
import PdfDocumentProperties from './components/PdfDocumentProperties.vue'
import {
  documentPropertiesPanelName,
  useDocumentPropertiesPanelState
} from './composables/usePdfDocumentProperties'
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
          fileContentOptions: { responseType: 'arraybuffer' },
          // Forms are often only filled in to print them, an autosave would change the file.
          disableAutoSave: true
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

    // In the right sidebar of the app, only for the open document.
    const { resourceId, properties } = useDocumentPropertiesPanelState()
    const extensions = computed(() => [
      {
        id: 'com.github.opencloud-eu.web-extensions.pdf-studio.sidebar-panel.document-properties',
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: documentPropertiesPanelName,
          // Not a named icon yet: the sidebar of older OpenCloud versions only takes a name.
          icon: 'file-pdf-2',
          iconFillType: 'line',
          title: () => $gettext('Document properties'),
          component: markRaw(PdfDocumentProperties),
          componentAttrs: ({ items }) => ({
            properties: unref(properties),
            fileName: items[0].name,
            fileSize: Number(items[0].size) || undefined
          }),
          isVisible: ({ items }) =>
            !!unref(resourceId) && items?.length === 1 && items[0].id === unref(resourceId)
        }
      } satisfies SidebarPanelExtension<SpaceResource, Resource, Resource>
    ])

    return {
      appInfo,
      routes,
      translations,
      extensions
    }
  }
})
