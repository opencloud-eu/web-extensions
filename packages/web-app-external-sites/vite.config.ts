import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'external-sites',
  test: {
    exclude: ['**/e2e/**']
  }
})
