import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // happy-dom is required for Vue component tests (window, DOM APIs);
    // the integration suite under tests/integration/ runs against a real
    // Hocuspocus server and only uses pure node APIs, so happy-dom is
    // transparent for it.
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    testTimeout: 20_000
  }
})
