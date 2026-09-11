import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'photos',
  test: {
    exclude: ['**/e2e/**']
  },
  server: {
    // module-federation keeps rewriting .__mf__temp/*/localSharedImportMap.js;
    // if the watcher sees that, every rewrite forces a full page reload
    watch: {
      ignored: ['**/.__mf__temp/**']
    },
    // fail loudly instead of silently binding 9211 when 9210 is taken,
    // two parallel servers fight over .__mf__temp and the dev registration
    strictPort: true
  }
})
