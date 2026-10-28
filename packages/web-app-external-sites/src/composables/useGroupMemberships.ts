import { useAuthStore, useClientService, useUserStore } from '@opencloud-eu/web-pkg'
import { watch } from 'vue'

// web doesn't load the group memberships during bootstrap, so we need to load them ourselves
export function useGroupMemberships() {
  const authStore = useAuthStore()
  const userStore = useUserStore()
  const clientService = useClientService()

  let resolveLoaded: () => void
  const groupMembershipsLoaded = new Promise<void>((resolve) => {
    resolveLoaded = resolve
  })

  async function loadGroupMemberships() {
    try {
      if (!userStore.user?.memberOf) {
        const { memberOf = [] } = await clientService.graphAuthenticated.users.getMe({
          expand: ['memberOf']
        })
        userStore.setUser({ ...userStore.user, memberOf })
      }
    } catch (e) {
      console.error('Failed to load group memberships', e)
    } finally {
      resolveLoaded()
    }
  }

  watch(
    () => authStore.userContextReady,
    (userContextReady) => {
      if (userContextReady) {
        loadGroupMemberships()
      }
    },
    { immediate: true }
  )

  return { groupMembershipsLoaded }
}
