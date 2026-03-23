import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'importer',
  build: {
    rolldownOptions: {
      // import.meta in @uppy dynamic imports is replaced with {} in UMD,
      // harmless because all dynamic imports are inlined (no code splitting)
      onwarn(warning, defaultHandler) {
        if (warning.code === 'EMPTY_IMPORT_META') return
        defaultHandler(warning)
      }
    }
  }
})
