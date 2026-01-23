import { useModals } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'

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
        confirmText: $gettext('Create'),
        hasInput: true,
        inputValue: defaultValue,
        inputLabel: label,
        inputRequiredMark: true,
        onConfirm: (value: string) => resolve(value),
        onCancel: () => resolve(null)
      })
    })
  }

  return {
    askForResourceName
  }
}
