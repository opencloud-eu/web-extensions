import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'web-app-arcade',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'arcade.js'
      }
    }
  }
})
