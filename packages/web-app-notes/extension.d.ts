/// <reference types="vite/client" />

// FIXME: remove when extension-sdk provides its own types
declare module '@opencloud-eu/extension-sdk' {
  const defineConfig: (config: any) => void
  export { defineConfig }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}
