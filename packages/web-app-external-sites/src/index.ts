import { urlJoin } from '@opencloud-eu/web-client'
import { AppMenuItemExtension, defineWebApplication } from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { computed, h } from 'vue'
import { RouteRecordRaw } from 'vue-router'
import { ExternalSitesConfigSchema } from './types'

import App from './App.vue'
import Dashboard from './ExternalSitesDashboard.vue'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()

    const appId = 'external-sites'

    const { sites, dashboards } = ExternalSitesConfigSchema.parse(applicationConfig)

    const routes: RouteRecordRaw[] = []
    const internalSites = sites.filter((s) => s.target === 'embedded')
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
      sites.map((s) => {
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

    dashboards.forEach((dashboard) => {
      routes.push({
        path: dashboard.path || '/',
        component: h(Dashboard, { dashboard }),
        name: `${appId}-dashboard-${dashboard.name}`,
        meta: {
          authContext: 'user',
          title: dashboard.name,
          patchCleanPath: true
        }
      })

      menuItems.value.push({
        id: `${appId}-dashboard-${dashboard.name}`,
        type: 'appMenuItem',
        label: () => dashboard.name,
        icon: dashboard.icon || 'grid',
        path: urlJoin(...[appId, dashboard.path].filter(Boolean)),
        ...(dashboard.color && { color: dashboard.color })
      })
    })

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
