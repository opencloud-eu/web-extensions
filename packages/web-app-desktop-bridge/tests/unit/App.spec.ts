import { reactive } from 'vue'

type User = { displayName?: string; onPremisesSamAccountName?: string; mail?: string }

const userStore = reactive({ user: null as User | null })

vi.mock('@opencloud-eu/web-pkg', () => ({
  defineWebApplication: (app: unknown) => app,
  useUserStore: () => userStore
}))

import app from '../../src/index'

const setup = () => (app as { setup: () => { appInfo: { id: string } } }).setup()

describe('desktop-bridge', () => {
  let execCommand: ReturnType<typeof vi.fn<(command: string, arg: string) => void>>

  beforeEach(() => {
    execCommand = vi.fn<(command: string, arg: string) => void>()
    userStore.user = null
    window.__ocDesktopBridgeAnnounced = undefined
    window.AscDesktopEditor = { execCommand }
  })

  it('registers the app but does nothing outside the desktop shell', () => {
    window.AscDesktopEditor = undefined
    userStore.user = { displayName: 'Alice' } as User

    expect(setup().appInfo.id).toBe('desktop-bridge')
    expect(execCommand).not.toHaveBeenCalled()
  })

  it('announces the portal once when the user is already known', () => {
    userStore.user = { displayName: 'Alice', onPremisesSamAccountName: 'alice' } as User

    setup()

    expect(execCommand).toHaveBeenCalledTimes(1)
    const [command, payload] = execCommand.mock.calls[0]
    expect(command).toBe('portal:login')
    expect(JSON.parse(payload)).toEqual({
      displayName: 'Alice',
      domain: window.location.origin,
      provider: 'opencloud'
    })
  })

  it('waits for the user to arrive, then announces exactly once', async () => {
    setup()
    expect(execCommand).not.toHaveBeenCalled()

    userStore.user = { displayName: 'Alice' } as User
    await nextTicks()
    expect(execCommand).toHaveBeenCalledTimes(1)

    userStore.user = { displayName: 'Someone Else' } as User
    await nextTicks()
    expect(execCommand).toHaveBeenCalledTimes(1)
  })

  it('falls back to the account name when the display name is missing', () => {
    userStore.user = { onPremisesSamAccountName: 'alice' } as User

    setup()

    expect(JSON.parse(execCommand.mock.calls[0][1]).displayName).toBe('alice')
  })

  it('never includes an email field in the payload', () => {
    userStore.user = { displayName: 'Alice', mail: 'alice@example.org' } as User

    setup()

    expect(JSON.parse(execCommand.mock.calls[0][1])).not.toHaveProperty('email')
  })
})

const nextTicks = () => new Promise((resolve) => setTimeout(resolve, 0))
