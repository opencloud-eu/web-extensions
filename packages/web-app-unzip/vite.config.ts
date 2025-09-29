import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'unzip',
  test: {
    exclude: ['**/e2e/**']
  }
})
