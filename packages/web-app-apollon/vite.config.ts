import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'apollon',
  server: {
    port: 9230,
    strictPort: true
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
