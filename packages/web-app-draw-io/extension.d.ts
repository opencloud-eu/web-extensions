/// <reference types="vite/client" />

// FIXME: remove when bumping vue3-gettext to v4
declare module 'vue3-gettext' {
  export function useGettext(): {
    $gettext(msgid: string): string
  }
}

// FIXME: remove when extension-sdk provides its own types
declare module '@opencloud-eu/extension-sdk' {
  const defineConfig: (config: any) => void
  export { defineConfig }
}

declare module 'qs' {
  export function parse(str: string): Record<string, string | string[]>
  export function stringify(obj: Record<string, any>, opts?: Record<string, any>): string
  export function parse(str: string, opts?: Record<string, any>): Record<string, any>
}
