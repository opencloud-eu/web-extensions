import { urlJoin } from '@opencloud-eu/web-client'
import { AppMenuItemExtension, defineWebApplication } from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { computed, h } from 'vue'
import { RouteRecordRaw } from 'vue-router'
import { ExternalSitesConfigSchema, isExternalSite, ExternalSite } from './types'

import App from './App.vue'
import Dashboard from './ExternalSitesDashboard.vue'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()

    const appId = 'external-sites'

    const { dashboard, sites = [] } = ExternalSitesConfigSchema.parse(applicationConfig)

    const routes: RouteRecordRaw[] = []
    const internalSites = sites.filter(
      (s) => isExternalSite(s) && s.target === 'embedded'
    ) as ExternalSite[]
    internalSites.forEach(({ name, url }) => {
      routes.push({
        path: urlJoin(encodeURIComponent(name).toLowerCase()),
        component: h(App, { name, url }),
        name: `${appId}-${name}`,
        meta: {
          authContext: 'user',
          title: name,
          patchCleanPath: true
        }
      })
    })

    const menuItems = computed<AppMenuItemExtension[]>(() =>
      sites
        .filter((s) => isExternalSite(s))
        .map((s) => {
          return {
            id: `${appId}-${s.name}`,
            type: 'appMenuItem',
            label: () => $gettext(s.name),
            color: s.color,
            icon: s.icon,
            priority: s.priority,
            ...(s.target === 'embedded' && {
              path: urlJoin(appId, encodeURIComponent(s.name).toLowerCase())
            }),
            ...(s.target === 'external' && { url: s.url })
          }
        })
    )

    if (dashboard?.enabled) {
      routes.push({
        path: '/',
        component: h(Dashboard, { sites }),
        name: `${appId}-dashboard`,
        meta: {
          authContext: 'user',
          title: dashboard.title || $gettext('Dashboard'),
          patchCleanPath: true
        }
      })

      menuItems.value.push({
        id: `${appId}-dashboard`,
        type: 'appMenuItem',
        label: () => dashboard.title || $gettext('Dashboard'),
        color: 'pink', //s.color,
        icon: 'grid',
        path: '/external-sites'
      })
    }

    return {
      appInfo: {
        name: $gettext('External Sites'),
        id: appId
      },
      routes,
      translations,
      extensions: menuItems
    }
  }
})
