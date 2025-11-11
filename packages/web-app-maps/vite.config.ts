import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'maps',
  test: {
    exclude: ['**/e2e/**']
  }
})
