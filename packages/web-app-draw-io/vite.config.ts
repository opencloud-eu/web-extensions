import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'web-app-draw-io',
  server: {
    port: 9724
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'draw-io.js'
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
