import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'draw-io',
  test: {
    exclude: ['**/e2e/**']
  }
})
