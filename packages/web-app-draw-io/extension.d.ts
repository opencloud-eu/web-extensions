/// <reference types="vite/client" />

declare module 'qs' {
  export function parse(str: string): Record<string, string | string[]>
  export function stringify(obj: Record<string, any>, opts?: Record<string, any>): string
  export function parse(str: string, opts?: Record<string, any>): Record<string, any>
}
