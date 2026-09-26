import { defineConfig } from '@opencloud-eu/extension-sdk'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  name: 'excalidraw',
  plugins: [
    // No @vitejs/plugin-react here on purpose: it injects a Fast Refresh preamble into the
    // host's HTML, which an extension loaded as a module federation remote never gets
    // ("can't detect preamble"). Vite transforms .tsx with esbuild anyway, driven by
    // `jsx: react-jsx` in tsconfig.json.
    // Excalidraw lazy-loads fonts, locales and lib data at runtime and would
    // otherwise pull them from esm.sh, which OpenCloud's CSP does not allow.
    // Mirror them into our own dist, see src/react_app/ExcalidrawCanvas.tsx.
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@excalidraw/excalidraw/dist/prod/{fonts,locales,data}',
          dest: 'excalidraw-assets'
        }
      ]
    })
  ],
  test: {
    exclude: ['**/e2e/**']
  }
})
