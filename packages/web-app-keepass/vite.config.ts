import { defineConfig } from '@opencloud-eu/extension-sdk'
import { Plugin } from 'vite'
import { readFileSync } from 'fs'

export default defineConfig({
  name: 'keepass',
  plugins: [
    {
      name: 'base64-loader',
      transform(code: string, id: string) {
        const [path, query] = id.split('?')
        if (query != 'base64') return null

        const data = readFileSync(path)
        const base64 = data.toString('base64')

        return `export default '${base64}';`
      }
    } as Plugin
  ],
  test: {
    exclude: ['**/e2e/**']
  }
})
