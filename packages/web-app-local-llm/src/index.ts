import { defineWebApplication } from '@opencloud-eu/web-pkg'
import { RouteRecordRaw } from 'vue-router'
import { useGettext } from 'vue3-gettext'
import translations from '../l10n/translations.json'
import './styles/common.css'

const applicationId = 'local-llm-opencloud'

export default defineWebApplication({
  setup() {
    const { $gettext } = useGettext()

    const appInfo = {
      id: applicationId,
      name: $gettext('Local LLM'),
      icon: 'brain',
      color: '#4a5568'
    }

    const routes: RouteRecordRaw[] = [
      {
        path: '/',
        redirect: `/${applicationId}/chat`
      },
      {
        path: '/chat',
        name: 'chat',
        component: () => import('./views/Chat.vue'),
        meta: {
          authContext: 'user',
          title: $gettext('Chat')
        }
      }
    ]

    return {
      appInfo,
      routes,
      translations
    }
  }
})
