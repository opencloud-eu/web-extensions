import { defineConfig } from '@ownclouders/extension-sdk'

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
  }
})
