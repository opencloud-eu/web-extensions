import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'web-app-unzip',
  server: {
    port: 9727
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'unzip.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
