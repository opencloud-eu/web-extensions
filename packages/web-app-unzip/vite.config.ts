import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'unzip',
  build: {
    rolldownOptions: {
      // import.meta.url in @zip.js/zip.js (baseURI config) is replaced with {} in UMD,
      // harmless because workerURI is explicitly set in useUnzipAction.ts
      onwarn(warning, defaultHandler) {
        if (warning.code === 'EMPTY_IMPORT_META') return
        defaultHandler(warning)
      }
    }
  },
  test: {
    exclude: ['**/e2e/**']
  }
})
