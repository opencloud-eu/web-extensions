import { defineWebApplication } from '@opencloud-eu/web-pkg'
import translations from '../l10n/translations.json'
import { useGettext } from 'vue3-gettext'
import { ref } from 'vue'
import { extensions } from './extensions'

export default defineWebApplication({
  setup({ applicationConfig }) {
    const { $gettext } = useGettext()

    // 'CC1AD845' seems to be a predefined app; check link
    // https://gist.github.com/jloutsenhizer/8855258
    const applicationId = applicationConfig?.receiverApplicationId || 'CC1AD845'

    const isAvailable = ref(false)
    window.__onGCastApiAvailable = (available) => {
      isAvailable.value = available
      console.log('Chromecast SDK available:', available)
      const castContext = cast.framework.CastContext.getInstance()

      castContext.setOptions({
        receiverApplicationId: applicationId,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      })

      castContext.addEventListener(
        cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event /*: cast.framework.CastStateEventData*/) => {
          switch (event.castState) {
            case cast.framework.CastState.NO_DEVICES_AVAILABLE:
              console.log('No Cast devices found')
              break
            case cast.framework.CastState.NOT_CONNECTED:
              console.log('Cast device available but not connected')
              break
            case cast.framework.CastState.CONNECTING:
              console.log('Connecting to Cast device')
              break
            case cast.framework.CastState.CONNECTED:
              console.log('Connected to Cast device')
              break
            default:
              console.warn('Unknown Cast device event', event)
          }
        }
      )
    }

    const script = document.createElement('script')
    script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'
    document.head.appendChild(script)

    const appInfo = {
      name: $gettext('Cast'),
      id: 'cast',
      icon: 'cast',
      iconFillType: 'line'
    } as const

    return {
      appInfo,
      translations,
      extensions: extensions({ applicationConfig, isAvailable })
    }
  }
})
