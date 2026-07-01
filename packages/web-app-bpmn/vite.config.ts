import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'bpmn',
  test: {
    exclude: ['**/e2e/**']
  }
})
