import translations from '../l10n/translations.json'
import {
  AppWrapperRoute,
  defineWebApplication,
  Extension,
  ApplicationSetupOptions,
  SidebarPanelExtension,
  FolderViewExtension
} from '@opencloud-eu/web-pkg'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import '@opencloud-eu/extension-sdk/tailwind.css'
import LocationPanel from './components/LocationPanel.vue'
import GpxMap from './components/GpxMap.vue'

import 'leaflet/dist/leaflet.css'
import 'leaflet-gpx'
import LocationFolderView from './components/LocationFolderView.vue'
import { MapsConfigSchema } from './types'
import './styles.css'
import { Resource } from '@opencloud-eu/web-client'

const applicationId = 'maps'
export default defineWebApplication({
  setup(args) {
    const { $gettext } = useGettext()

    const { folderViewEnabled } = MapsConfigSchema.parse(args.applicationConfig)

    const extensions = ({ applicationConfig }: ApplicationSetupOptions) => {
      return computed(
        () =>
          [
            {
              id: 'com.github.opencloud-eu.maps.sidebar-panel',
              type: 'sidebarPanel',
              extensionPointIds: ['global.files.sidebar'],
              panel: {
                name: 'location-details',
                icon: 'map-2',
                iconFillType: 'line',
                title: () => $gettext('Location'),
                component: LocationPanel,
                componentAttrs: (panelContext) => {
                  return {
                    panelContext,
                    applicationConfig
                  }
                },
                isRoot: () => true,
                isVisible: ({ items }) => {
                  return items?.length > 0 && items?.some((item) => !!item.location)
                }
              }
            } as SidebarPanelExtension<Resource, Resource, Resource>,
            ...(folderViewEnabled
              ? [
                  {
                    id: 'com.github.opencloud-eu.maps.folder-view.map-view',
                    type: 'folderView',
                    extensionPointIds: ['app.files.folder-views.folder'],
                    folderView: {
                      name: 'resource-map',
                      label: $gettext('Switch to map view'),
                      icon: {
                        name: 'map-2',
                        fillType: 'line'
                      },
                      component: LocationFolderView,
                      componentAttrs: () => ({ applicationConfig })
                    }
                  } as FolderViewExtension
                ]
              : [])
          ] satisfies Extension[]
      )
    }

    const routes = [
      {
        name: 'maps',
        path: '/:driveAliasAndItem(.*)?',
        component: AppWrapperRoute(GpxMap, {
          applicationId,
          urlForResourceOptions: {
            disposition: 'inline'
          }
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('Maps'),
          patchCleanPath: true
        }
      }
    ]

    return {
      appInfo: {
        name: $gettext('Maps'),
        id: applicationId,
        icon: 'map-2',
        iconFillType: 'line',
        iconColor: '#84c143',
        extensions: [
          {
            extension: 'gpx',
            routeName: 'maps',
            canBeDefault: true
          }
        ]
      },
      routes,
      translations,
      extensions: extensions(args)
    }
  }
})
