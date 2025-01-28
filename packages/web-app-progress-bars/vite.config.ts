import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'web-app-progress-bars',
  server: {
    port: 9723
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'progress-bars.js'
      }
    }
  }
})
