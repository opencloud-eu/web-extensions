import { useUserStore } from '@opencloud-eu/web-pkg'
import { Group } from '@opencloud-eu/web-client/graph/generated'
import { createMockStore } from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { createVisibilityGuard } from '../../src/utils'

describe('createVisibilityGuard', () => {
  beforeEach(() => {
    createMockStore()
  })

  it('allows navigation without group requirements', async () => {
    const guard = createVisibilityGuard(undefined, new Promise(() => undefined))
    expect(await guard()).toBe(true)
  })

  it('waits for the group memberships before checking the groups', async () => {
    let resolveLoaded: () => void
    const groupMembershipsLoaded = new Promise<void>((resolve) => {
      resolveLoaded = resolve
    })
    const guard = createVisibilityGuard({ groups: { any: ['admin'] } }, groupMembershipsLoaded)

    const result = guard()
    const userStore = useUserStore()
    userStore.user.memberOf = [mock<Group>({ displayName: 'admin' })]
    resolveLoaded()

    expect(await result).toBe(true)
  })

  it('redirects if the user is missing the required groups', async () => {
    const userStore = useUserStore()
    userStore.user.memberOf = [mock<Group>({ displayName: 'viewer' })]
    const guard = createVisibilityGuard({ groups: { any: ['admin'] } }, Promise.resolve())

    expect(await guard()).toBe('/')
  })
})
