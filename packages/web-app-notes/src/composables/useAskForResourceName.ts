import { useModals } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import TextInputModal from '../components/TextInputModal.vue'

export const useAskForResourceName = () => {
  const { $gettext } = useGettext()
  const { dispatchModal } = useModals()

  const askForResourceName = (
    title: string,
    label: string,
    defaultValue: string
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      dispatchModal({
        title,
        customComponent: TextInputModal,
        hideActions: true,
        customComponentAttrs: () => ({
          defaultValue,
          label,
          placeholder: label,
          confirmText: $gettext('Create'),
          actionCallback: (value: string) => resolve(value),
          cancelCallback: () => resolve(null)
        }),
        onCancel: () => resolve(null)
      })
    })
  }

  return {
    askForResourceName
  }
}
