import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'calendar',
  test: {
    exclude: ['**/e2e/**']
  }
})
