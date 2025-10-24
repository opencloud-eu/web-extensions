import {
  ApplicationSetupOptions,
  Extension,
  UppyService,
  useAuthStore,
  useModals,
  useResourcesStore,
  useService,
  useThemeStore,
  useUserStore
} from '@opencloud-eu/web-pkg'
import '@uppy/dashboard/css/style.min.css'
import Webdav from '@uppy/webdav'
import { storeToRefs } from 'pinia'
import { useGettext } from 'vue3-gettext'
import { computed, nextTick, unref } from 'vue'
import { PluginTarget } from '@uppy/core'

export const useExtensions = ({ applicationConfig }: ApplicationSetupOptions) => {
  const userStore = useUserStore()
  const { $gettext } = useGettext()
  const uppyService = useService<UppyService>('$uppyService')
  const authStore = useAuthStore()
  const themeStore = useThemeStore()
  const { currentTheme } = storeToRefs(themeStore)
  const modals = useModals()
  const { dispatchModal, removeModal } = modals
  const { activeModal } = storeToRefs(modals)

  const resourcesStore = useResourcesStore()
  const { currentFolder } = storeToRefs(resourcesStore)

  const { companionUrl, webdavCloudType } = applicationConfig
  let { supportedClouds } = applicationConfig
  supportedClouds = supportedClouds || ['OneDrive', 'GoogleDrive', 'WebdavPublicLink']

  const canUpload = computed(() => {
    return unref(currentFolder)?.canUpload({ user: userStore.user })
  })

  const removeUppyPlugins = () => {
    const dashboardPlugin = uppyService.getPlugin('Dashboard')
    if (dashboardPlugin) {
      uppyService.removePlugin(dashboardPlugin)
    }
    for (const cloud of supportedClouds) {
      const plugin = uppyService.getPlugin(cloud)
      if (plugin) {
        uppyService.removePlugin(plugin)
      }
    }
  }

  uppyService.subscribe('addedForUpload', () => {
    if (unref(activeModal)) {
      removeModal(unref(activeModal).id)
    }
  })

  uppyService.subscribe('uploadCompleted', () => {
    removeUppyPlugins()
  })

  const getUppyPlugins = async () => {
    // lazy loading to avoid loading these on page load
    const Dashboard = (await import('@uppy/dashboard')).default
    const OneDrive = (await import('@uppy/onedrive')).default
    const GoogleDrive = (await import('@uppy/google-drive')).default
    return { Dashboard, OneDrive, GoogleDrive }
  }

  const handler = async () => {
    const { Dashboard, OneDrive, GoogleDrive } = await getUppyPlugins()
    const renderDarkTheme = unref(currentTheme).isDark

    dispatchModal({
      title: $gettext('Import files'),
      hideConfirmButton: true,
      onCancel: () => {
        removeUppyPlugins()
      }
    })

    await nextTick()

    uppyService.addPlugin(Dashboard, {
      inline: true,
      target: '.oc-modal-body',
      disableLocalFiles: true,
      disableStatusBar: true,
      showSelectedFiles: false,
      ...(renderDarkTheme && { theme: 'dark' }),
      locale: {
        pluralize: (n: number) => (n === 1 ? 0 : 1),
        strings: {
          cancel: $gettext('Cancel'),
          importFiles: $gettext('Import files from:'),
          importFrom: $gettext('Import from %{name}')
        }
      } as any
    })

    if (supportedClouds.includes('OneDrive')) {
      uppyService.addPlugin(OneDrive, {
        target: Dashboard as PluginTarget<any, any>,
        companionUrl
      })
    }

    if (supportedClouds.includes('GoogleDrive')) {
      uppyService.addPlugin(GoogleDrive, {
        target: Dashboard as PluginTarget<any, any>,
        companionUrl
      })
    }

    if (supportedClouds.includes('WebdavPublicLink')) {
      uppyService.addPlugin(Webdav, {
        target: Dashboard as any,
        id: 'WebdavPublicLink',
        companionUrl,
        ...(webdavCloudType && { cloudType: webdavCloudType })
      })
    }
  }

  return computed<Extension[]>(() => [
    {
      id: 'com.github.opencloud-eu.web.import-file',
      type: 'action',
      extensionPointIds: ['app.files.upload-menu'],
      action: {
        name: 'import-files',
        icon: 'upload-cloud',
        handler,
        label: () => $gettext('Import'),
        isVisible: () => {
          if (!companionUrl) {
            return false
          }

          if (authStore.publicLinkContextReady) {
            return false
          }

          return unref(canUpload) && supportedClouds.length
        },
        isDisabled: () => !!Object.keys(uppyService.getCurrentUploads()).length,
        disabledTooltip: () => $gettext('Please wait until all imports have finished'),
        class: 'oc-files-actions-import'
      }
    }
  ])
}
