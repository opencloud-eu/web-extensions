import { ActionExtension, ApplicationSetupOptions, UppyService } from '@opencloud-eu/web-pkg'
import { Resource } from '@opencloud-eu/web-client'
import { defaultComponentMocks, getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { mock, mockDeep } from 'vitest-mock-extended'
import { unref } from 'vue'
import { useExtensions } from '../../../src/composables/useExtensions'

describe('importer action', () => {
  describe('isVisible', () => {
    it('is false when no companion url is given', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => true }),
        supportedClouds: ['onedrive'],
        companionUrl: '',
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isVisible()).toBeFalsy()
        }
      })
    })
    it('is false in public link context', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => true }),
        supportedClouds: ['onedrive'],
        publicLinkContextReady: true,
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isVisible()).toBeFalsy()
        }
      })
    })
    it('is false when no supported clouds are given', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => true }),
        supportedClouds: [],
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isVisible()).toBeFalsy()
        }
      })
    })
    it('is false on generic space view when no write access is given', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => false }),
        supportedClouds: ['onedrive'],
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isVisible()).toBeFalsy()
        }
      })
    })
    it('is true on generic space view when write access is given', () => {
      getWrapper({
        currentFolder: mock<Resource>({ canUpload: () => true }),
        supportedClouds: ['onedrive'],
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isVisible()).toBeTruthy()
        }
      })
    })
  })
  describe('isDisabled', () => {
    it('is true when uploads are running', () => {
      const uppyService = mockDeep<UppyService>()
      uppyService.getCurrentUploads.mockReturnValue({ id: '1' })
      getWrapper({
        uppyService,
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isDisabled()).toBeTruthy()
        }
      })
    })
    it('is false when no uploads are running', () => {
      const uppyService = mockDeep<UppyService>()
      uppyService.getCurrentUploads.mockReturnValue({})
      getWrapper({
        uppyService,
        setup: (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          expect(action.isDisabled()).toBeFalsy()
        }
      })
    })
  })
  describe('handler', () => {
    it.each([
      { supportedClouds: undefined, addPluginCalls: 4 },
      { supportedClouds: ['OneDrive'], addPluginCalls: 2 },
      { supportedClouds: ['GoogleDrive'], addPluginCalls: 2 },
      { supportedClouds: ['WebdavPublicLink'], addPluginCalls: 2 }
    ])('should only add supported clouds as uppy plugin', ({ supportedClouds, addPluginCalls }) => {
      const uppyService = mockDeep<UppyService>()
      getWrapper({
        uppyService,
        supportedClouds,
        setup: async (instance) => {
          const action = (unref(instance)[0] as ActionExtension).action
          await action.handler()
          expect(uppyService.addPlugin).toHaveBeenCalledTimes(addPluginCalls)
        }
      })
    })
  })
})

function getWrapper({
  setup,
  currentFolder,
  companionUrl = 'https://example.com',
  supportedClouds,
  publicLinkContextReady = false,
  uppyService = mockDeep<UppyService>()
}: {
  setup: (instance: ReturnType<typeof useExtensions>) => void
  currentFolder?: Resource
  companionUrl?: string
  supportedClouds?: string[]
  publicLinkContextReady?: boolean
  uppyService?: UppyService
}) {
  const mocks = {
    ...defaultComponentMocks(),
    $uppyService: uppyService
  }

  return {
    wrapper: getComposableWrapper(
      () => {
        const instance = useExtensions(
          mock<ApplicationSetupOptions>({ applicationConfig: { companionUrl, supportedClouds } })
        )
        setup(instance)
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: {
          piniaOptions: { resourcesStore: { currentFolder }, authState: { publicLinkContextReady } }
        }
      }
    )
  }
}
