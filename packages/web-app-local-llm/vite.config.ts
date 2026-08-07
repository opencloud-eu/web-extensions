import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'local-llm-opencloud',
  test: {
    exclude: ['**/e2e/**']
  }
})
