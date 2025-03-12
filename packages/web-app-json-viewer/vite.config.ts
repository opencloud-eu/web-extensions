import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'web-app-json-viewer',
  server: {
    port: 9726
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'json-viewer.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
