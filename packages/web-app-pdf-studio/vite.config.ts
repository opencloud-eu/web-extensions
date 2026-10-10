import { defineConfig } from '@opencloud-eu/extension-sdk'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// PDF.js loads its worker, form scripting sandbox, CMaps, standard fonts, ICC profiles, wasm
// decoders and annotation icons at runtime. Mirror them into our own dist so nothing is fetched from a CDN, which
// OpenCloud's CSP would block anyway. See src/helpers/pdfjs.ts for the lookup side.
const pdfjsAssets = [
  'build/pdf.worker.min.mjs',
  'build/pdf.sandbox.mjs',
  'build/pdf.sandbox.mjs.map',
  'cmaps',
  'standard_fonts',
  'iccs',
  'wasm',
  'web/images'
]

export default defineConfig({
  name: 'pdf-studio',
  plugins: [
    viteStaticCopy({
      targets: pdfjsAssets.map((src) => ({
        src: `node_modules/pdfjs-dist/${src}`,
        dest: 'pdfjs',
        rename: { stripBase: src.includes('/') ? 3 : 2 }
      }))
    }),
    {
      // pdf_viewer.css declares its variables and `color-scheme: light dark` on `:root`,
      // which would leak into the whole OpenCloud UI. Scope them to our viewer instead,
      // where `color-scheme` follows the OpenCloud theme (see PdfStudio.vue).
      name: 'pdf-studio-scope-pdfjs-css',
      enforce: 'pre',
      transform(code, id) {
        if (!id.includes('pdfjs-dist/web/pdf_viewer.css')) {
          return
        }
        // PDF.js reads these from `document.documentElement` in JS (e.g. to place new text
        // annotations), so they have to stay on the actual root element.
        const rootVariables = ['--outline-width', '--freetext-padding']
          .map((name) => `${name}: ${code.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]};`)
          .join(' ')
        return {
          code: code.replaceAll(':root', '.pdf-studio') + `\n:root { ${rootVariables} }\n`,
          map: null
        }
      }
    }
  ]
})
