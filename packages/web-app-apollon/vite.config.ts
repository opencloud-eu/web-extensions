import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'apollon',
  test: {
    exclude: ['**/e2e/**']
  }
})
