/// <reference types="vite/client" />

// FIXME: remove when bumping vue3-gettext to v4
declare module 'vue3-gettext' {
  export function useGettext(): {
    $gettext(msgid: string): string
    current: string
    available: string[]
  }
  export interface GetTextOptions {
    availableLanguages: Record<string, string>
    defaultLanguage: string
    translations: Record<string, any>
  }
  export function createGettext(options: GetTextOptions): any
}

// FIXME: remove when extension-sdk provides its own types
declare module '@opencloud-eu/extension-sdk' {
  const defineConfig: (config: any) => void
  export { defineConfig }
}
