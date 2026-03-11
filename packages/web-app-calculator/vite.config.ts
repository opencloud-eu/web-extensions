import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'calculator',
  test: {
    exclude: ['**/e2e/**']
  }
})
