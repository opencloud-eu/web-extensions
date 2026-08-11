import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'photos',
  test: {
    exclude: ['**/e2e/**']
  }
})
