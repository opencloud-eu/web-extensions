import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { ActionExtension, ApplicationSetupOptions } from '@opencloud-eu/web-pkg'
import { defaultComponentMocks, getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { ref, unref } from 'vue'
import { extensions } from '../../src/extensions'

describe('cast action', () => {
  describe('isVisible', () => {
    it('is false if not available', () => {
      getWrapper({
        isAvailable: false,
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: false })
          expect(action.isVisible({ resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is false if resource is a folder', () => {
      getWrapper({
        isAvailable: true,
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: true })
          expect(action.isVisible({ resources: [resource] })).toBeFalsy()
        }
      })
    })
    it('is true if available and resource is a file', () => {
      getWrapper({
        isAvailable: true,
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: false })
          expect(action.isVisible({ resources: [resource] })).toBeTruthy()
        }
      })
    })
  })
  describe('handler', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined)

    let sessionInstance: any = undefined
    const MediaInfo = vi.fn()
    const LoadRequest = vi.fn()

    Object.defineProperty(global, 'cast', {
      value: { framework: { CastContext: { getInstance: () => sessionInstance } } }
    })

    Object.defineProperty(global, 'chrome', {
      value: { cast: { media: { MediaInfo, LoadRequest } } }
    })

    beforeEach(() => {
      sessionInstance = mock<cast.framework.CastContext>({
        getCurrentSession: vi.fn(),
        requestSession: vi.fn()
      })
    })

    afterEach(() => {
      sessionInstance = undefined
    })

    it('throws errors if no cast session available and requesting it fails', () => {
      getWrapper({
        isAvailable: false,
        setup: async (instance) => {
          const errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: false })
          const space = mock<SpaceResource>()
          sessionInstance.requestSession.mockRejectedValue(new Error(''))

          await action.handler({ space, resources: [resource] })
          expect(errorLogSpy).toHaveBeenCalledTimes(2)
        }
      })
    })
    it('requests a new cast session if none is available', () => {
      getWrapper({
        isAvailable: false,
        setup: async (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: false })
          const space = mock<SpaceResource>()

          await action.handler({ space, resources: [resource] })
          expect(sessionInstance.requestSession).toHaveBeenCalledTimes(1)
        }
      })
    })
    it('calls "loadMedia" on the cast session when available', () => {
      getWrapper({
        isAvailable: false,
        setup: async (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: false })
          const space = mock<SpaceResource>()

          const castSession = mock<cast.framework.CastSession>()
          sessionInstance.getCurrentSession.mockReturnValue(castSession)

          await action.handler({ space, resources: [resource] })
          expect(castSession.loadMedia).toHaveBeenCalledTimes(1)
        }
      })
    })
    it('initiates "MediaInfo" with the resource image url and its mime type', () => {
      getWrapper({
        isAvailable: false,
        setup: async (instance, mocks) => {
          const action = (unref(instance)[0] as ActionExtension).action
          const resource = mock<Resource>({ isFolder: false, mimeType: 'image/png' })
          const space = mock<SpaceResource>()

          const castSession = mock<cast.framework.CastSession>()
          sessionInstance.getCurrentSession.mockReturnValue(castSession)

          const imageUrl = 'imageUrl'
          mocks.$clientService.webdav.getFileUrl.mockResolvedValue(imageUrl)

          await action.handler({ space, resources: [resource] })
          expect(MediaInfo).toHaveBeenCalledWith(imageUrl, resource.mimeType)
        }
      })
    })
  })
})

function getWrapper({
  setup,
  isAvailable = true
}: {
  setup: (
    instance: ReturnType<typeof extensions>,
    mocks: ReturnType<typeof defaultComponentMocks>
  ) => void
  isAvailable?: boolean
}) {
  const mocks = { ...defaultComponentMocks() }

  return {
    wrapper: getComposableWrapper(
      () => {
        const instance = extensions({
          ...mock<ApplicationSetupOptions>(),
          isAvailable: ref(isAvailable)
        })
        setup(instance, mocks)
      },
      {
        mocks,
        provide: mocks
      }
    )
  }
}
