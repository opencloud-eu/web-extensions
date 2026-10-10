import { AppWrapperRoute } from '@opencloud-eu/web-pkg'
import app, { applicationId } from '../../src/index'

vi.mock('vue3-gettext', () => ({ useGettext: () => ({ $gettext: (msg: string) => msg }) }))
vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@opencloud-eu/web-pkg')>()),
  AppWrapperRoute: vi.fn(() => ({}))
}))

function setupApp() {
  return app.setup({ applicationConfig: {} } as never) as {
    appInfo: { id: string; extensions: { extension: string; routeName: string }[] }
    routes: { name: string }[]
  }
}

describe('PDF Studio application', () => {
  it('opens pdf files', () => {
    const { appInfo, routes } = setupApp()
    expect(appInfo.id).toBe(applicationId)
    expect(appInfo.extensions).toEqual([
      expect.objectContaining({ extension: 'pdf', routeName: applicationId })
    ])
    expect(routes[0].name).toBe(applicationId)
  })

  it('loads the file content as binary', () => {
    setupApp()
    expect(AppWrapperRoute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fileContentOptions: { responseType: 'arraybuffer' } })
    )
  })
})
