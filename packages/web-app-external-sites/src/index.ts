import { urlJoin } from '@opencloud-eu/web-client'
import { AppMenuItemExtension, defineWebApplication } from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { computed, h } from 'vue'
import { RouteRecordRaw } from 'vue-router'
import { ExternalSitesConfigSchema, ExternalSite } from './types'
import {
  shouldDisplay,
  filterVisibleSites,
  createVisibilityGuard,
  makeSlug,
  flattenSites
} from './utils'

import '@opencloud-eu/extension-sdk/tailwind.css'
import App from './App.vue'
import Dashboard from './ExternalSitesDashboard.vue'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()

    const appId = 'external-sites'

    const { sites, dashboards, defaultDashboard } =
      ExternalSitesConfigSchema.parse(applicationConfig)

    const routes: RouteRecordRaw[] = []

    // Add site routes (only embedded sites get routes)
    const internalSites = sites.filter((s) => s.target === 'embedded')
    internalSites.forEach(({ name, url, visibility }) => {
      routes.push({
        path: urlJoin(encodeURIComponent(makeSlug(name))),
        component: h(App, { name, url }),
        name: `${appId}-${name}`,
        meta: {
          authContext: 'user',
          title: name,
          patchCleanPath: true
        },
        ...(visibility && { beforeEnter: createVisibilityGuard(visibility) })
      })
    })

    // Add dashboard routes
    dashboards.forEach((dashboard, i) => {
      let entryPoint = false
      if (defaultDashboard) {
        entryPoint = defaultDashboard === dashboard.name
      } else {
        entryPoint = i === 0
      }

      const dashboardPath = dashboard.path || '/'

      routes.push({
        path: dashboardPath,
        component: h(Dashboard, { dashboard }),
        name: `${appId}-dashboard-${dashboard.name}`,
        meta: {
          authContext: 'user',
          title: dashboard.name,
          patchCleanPath: true,
          entryPoint
        },
        ...(dashboard.visibility && { beforeEnter: createVisibilityGuard(dashboard.visibility) })
      })

      // Create nested routes for embedded dashboard sites
      const allDashboardSites: ExternalSite[] = flattenSites(dashboard.sites)

      // Create nested routes for embedded sites
      allDashboardSites
        .filter((site) => site.target === 'embedded')
        .forEach((site) => {
          const sitePath = makeSlug(site.name)

          // Always create: /external-sites/dashboard-path/site-name
          const nestedPath = urlJoin(dashboardPath, sitePath)
          routes.push({
            path: nestedPath,
            component: h(App, { name: site.name, url: site.url }),
            name: `${appId}-dashboard-${dashboardPath}-${sitePath}`,
            meta: {
              authContext: 'user',
              title: site.name,
              patchCleanPath: true
            },
            ...(site.visibility && { beforeEnter: createVisibilityGuard(site.visibility) })
          })
        })
    })

    // Computed for menu items
    const menuItems = computed<AppMenuItemExtension[]>(() => {
      // Filter top-level sites
      const actualSites = sites.filter((s) => shouldDisplay(s.visibility))

      // Filter dashboards and their nested sites
      const actualDashboards = dashboards.filter((d) => {
        // First check if user can see the dashboard itself
        if (!shouldDisplay(d.visibility)) return false

        // Then check if the dashboard has any visible sites
        const filteredSites = filterVisibleSites(d.sites)

        return filteredSites.length > 0
      })

      const siteMenuItems = actualSites.map((s) => ({
        id: `${appId}-${s.name}`,
        type: 'appMenuItem' as const,
        label: () => $gettext(s.name),
        color: s.color,
        icon: s.icon,
        priority: s.priority,
        ...(s.target === 'embedded' && {
          path: urlJoin(appId, encodeURIComponent(makeSlug(s.name)))
        }),
        ...(s.target === 'external' && { url: s.url })
      }))

      const dashboardMenuItems = actualDashboards.map((dashboard) => ({
        id: `${appId}-dashboard-${dashboard.name}`,
        type: 'appMenuItem' as const,
        label: () => dashboard.name,
        icon: dashboard.icon || 'grid',
        path: urlJoin(...[appId, dashboard.path].filter(Boolean)),
        ...(dashboard.color && { color: dashboard.color })
      }))

      return [...siteMenuItems, ...dashboardMenuItems]
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
