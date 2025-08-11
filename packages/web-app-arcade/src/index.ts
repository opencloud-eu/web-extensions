import App from './App.vue'
import { AppWrapperRoute } from '@opencloud-eu/web-pkg'

// just a dummy function to trick gettext tools
function $gettext(msg: string): string {
  return msg
}

const routes = [
  {
    path: '/:driveAliasAndItem(.*)?',
    component: AppWrapperRoute(App, {
      applicationId: 'arcade'
    }),
    name: 'arcade',
    meta: {
      authContext: 'hybrid',
      title: $gettext('Arcade'),
      patchCleanPath: true
    }
  }
]

const appInfo = {
  name: $gettext('Arcade'),
  id: 'arcade',
  icon: 'game',
  iconFillType: 'fill',
  iconColor: 'rgb(255,255,0)',
  extensions: [
    {
      extension: 'nes',
      routeName: 'arcade'
    }
  ]
}

export default {
  appInfo,
  routes
}
