import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'json-viewer',
  build: {
    rolldownOptions: {
      // import.meta in vanilla-jsoneditor (vanilla-picker dynamic import) is replaced with {} in UMD,
      // harmless because all dynamic imports are inlined (no code splitting)
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
