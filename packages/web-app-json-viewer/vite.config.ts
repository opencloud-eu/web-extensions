import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'json-viewer',
  test: {
    exclude: ['**/e2e/**']
  }
})
