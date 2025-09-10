import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'web-app-unzip',
  test: {
    exclude: ['**/e2e/**']
  }
})
