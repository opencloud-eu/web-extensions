import { AuthStore, useAuthStore, useUserStore } from '@opencloud-eu/web-pkg'
import { Group, User } from '@opencloud-eu/web-client/graph/generated'
import { defaultComponentMocks, getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { nextTick, reactive } from 'vue'
import { useGroupMemberships } from '../../../src/composables/useGroupMemberships'

// the web-pkg build bundles its own vue reactivity, so its store refs can't be watched from here
vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@opencloud-eu/web-pkg')>()),
  useAuthStore: vi.fn()
}))

describe('useGroupMemberships', () => {
  it('does not load the group memberships before the user context is ready', () => {
    getWrapper({
      userContextReady: false,
      setup: (_, mocks) => {
        expect(mocks.$clientService.graphAuthenticated.users.getMe).not.toHaveBeenCalled()
      }
    })
  })

  it('loads the group memberships once the user context becomes ready', async () => {
    const memberOf = [mock<Group>({ displayName: 'admin' })]
    const { mocks, result, authStore } = getWrapper({ userContextReady: false, memberOf })

    authStore.userContextReady = true
    await nextTick()
    await result.groupMembershipsLoaded

    expect(mocks.$clientService.graphAuthenticated.users.getMe).toHaveBeenCalledWith({
      expand: ['memberOf']
    })
    const userStore = useUserStore()
    expect(userStore.setUser).toHaveBeenCalledWith(expect.objectContaining({ memberOf }))
  })

  it('loads the group memberships and stores them in the user store', async () => {
    const memberOf = [mock<Group>({ displayName: 'admin' })]
    const { mocks, result } = getWrapper({ memberOf })

    await result.groupMembershipsLoaded

    expect(mocks.$clientService.graphAuthenticated.users.getMe).toHaveBeenCalledWith({
      expand: ['memberOf']
    })
    const userStore = useUserStore()
    expect(userStore.setUser).toHaveBeenCalledWith(expect.objectContaining({ id: '1', memberOf }))
  })

  it('does not load the group memberships if they are already present', async () => {
    const { mocks, result } = getWrapper({ user: { memberOf: [] } })

    await result.groupMembershipsLoaded

    expect(mocks.$clientService.graphAuthenticated.users.getMe).not.toHaveBeenCalled()
  })

  it('resolves even if loading the group memberships fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(undefined)
    const { mocks, result } = getWrapper({ getMeError: true })

    await result.groupMembershipsLoaded

    expect(mocks.$clientService.graphAuthenticated.users.getMe).toHaveBeenCalled()
    const userStore = useUserStore()
    expect(userStore.setUser).not.toHaveBeenCalled()
  })
})

function getWrapper({
  setup = () => undefined,
  userContextReady = true,
  user = {},
  memberOf = [],
  getMeError = false
}: {
  setup?: (
    instance: ReturnType<typeof useGroupMemberships>,
    mocks: ReturnType<typeof defaultComponentMocks>
  ) => void
  userContextReady?: boolean
  user?: Partial<User>
  memberOf?: Group[]
  getMeError?: boolean
} = {}) {
  const mocks = defaultComponentMocks()
  if (getMeError) {
    mocks.$clientService.graphAuthenticated.users.getMe.mockRejectedValue(new Error())
  } else {
    mocks.$clientService.graphAuthenticated.users.getMe.mockResolvedValue(mock<User>({ memberOf }))
  }

  const authStore = reactive({ userContextReady })
  vi.mocked(useAuthStore).mockReturnValue(authStore as AuthStore)

  let result: ReturnType<typeof useGroupMemberships>
  const wrapper = getComposableWrapper(
    () => {
      result = useGroupMemberships()
      setup(result, mocks)
    },
    {
      mocks,
      provide: mocks,
      pluginOptions: {
        piniaOptions: { userState: { user: user as User } }
      }
    }
  )

  return { wrapper, mocks, result, authStore }
}
