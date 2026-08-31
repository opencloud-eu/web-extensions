import { defineWebApplication, useUserStore } from '@opencloud-eu/web-pkg'
import { watch } from 'vue'

// The ONLYOFFICE / Euro-Office desktop shell only lists a connected portal in
// its "Clouds" panel when the portal page itself announces the login via
// AscDesktopEditor.execCommand('portal:login', ...) — in Nextcloud the
// ONLYOFFICE connector app does this (src/desktop.js). OpenCloud has no
// connector, so this extension fills that role. Outside the desktop shell
// (no window.AscDesktopEditor) it does nothing.

declare global {
  interface Window {
    AscDesktopEditor?: { execCommand: (command: string, arg: string) => void }
    __ocDesktopBridgeAnnounced?: boolean
  }
}

export default defineWebApplication({
  setup() {
    if (window.AscDesktopEditor) {
      const userStore = useUserStore()

      const announce = (): boolean => {
        if (window.__ocDesktopBridgeAnnounced) {
          return true
        }
        const user = userStore.user
        // Prefer the human-readable name: deployments that autoprovision from the
        // OIDC `sub` claim have opaque UUIDs as account names.
        const displayName = user?.displayName || user?.onPremisesSamAccountName
        if (!displayName) {
          return false
        }
        // Mirror the Nextcloud connector's payload exactly: displayName,
        // domain, provider — and nothing more. The start page's portal:login
        // handler compares an `email` field against the session's portal
        // model with no fallback on mismatch, so sending a real email
        // silently drops the event.
        window.AscDesktopEditor.execCommand(
          'portal:login',
          JSON.stringify({
            displayName,
            domain: window.location.origin,
            provider: 'opencloud'
          })
        )
        window.__ocDesktopBridgeAnnounced = true
        return true
      }

      // The user lands in the store shortly after the OIDC callback, so watch
      // for it instead of assuming it is present at app boot.
      if (!announce()) {
        const stop = watch(
          () => userStore.user,
          () => {
            if (announce()) {
              stop()
            }
          }
        )
      }
    }

    return {
      appInfo: {
        id: 'desktop-bridge',
        name: 'Desktop Bridge'
      }
    }
  }
})
