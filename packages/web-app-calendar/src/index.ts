import { defineWebApplication, Extension, AppMenuItemExtension } from '@opencloud-eu/web-pkg'
import { urlJoin } from '@opencloud-eu/web-client'
import { RouteRecordRaw } from 'vue-router'
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import AppShell from './components/AppShell.vue'
import { setCaldavRoot } from './clients/caldav'
import { setBridgeBase, setBridgeEnabled } from './clients/bridge'

export default defineWebApplication({
  setup(options) {
    const { $gettext } = useGettext()

    // Optional per-deployment overrides from the app's config.json, so the
    // CalDAV and bridge prefixes can match whatever the proxy is configured with.
    // "bridge": false hides the subscription/sharing UI when no companion bridge
    // is deployed, leaving a clean CalDAV-only calendar.
    const cfg = (options?.applicationConfig || {}) as {
      caldavRoot?: string
      bridgeBase?: string
      bridge?: boolean
    }
    setCaldavRoot(cfg.caldavRoot)
    setBridgeBase(cfg.bridgeBase)
    setBridgeEnabled(cfg.bridge !== false)

    const appInfo = {
      id: 'calendar',
      name: $gettext('Calendar'),
      icon: 'calendar-2',
      color: '#0082c9'
    }

    // One flat route renders the shell, which switches between Calendar / Tasks
    // / Calendars internally. Flat (like the reference apps) avoids nested-route
    // resolution issues, and keeps a single app-switcher tile.
    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        name: `${appInfo.id}-home`,
        component: AppShell,
        meta: { authContext: 'user', title: appInfo.name }
      }
    ]

    const extensions = computed<Extension[]>(() => {
      const menuItems: AppMenuItemExtension[] = [
        {
          id: `app.${appInfo.id}.menuItem`,
          type: 'appMenuItem',
          label: () => appInfo.name,
          color: appInfo.color,
          icon: appInfo.icon,
          path: urlJoin(appInfo.id)
        }
      ]
      return menuItems
    })

    return {
      appInfo,
      routes,
      translations,
      extensions
    }
  }
})
