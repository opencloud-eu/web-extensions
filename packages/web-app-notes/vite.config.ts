import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'notes',
  test: {
    exclude: ['**/e2e/**']
  }
})
