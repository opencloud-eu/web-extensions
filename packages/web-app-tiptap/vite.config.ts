import { defineConfig } from '@opencloud-eu/extension-sdk'

export default defineConfig({
  name: 'tiptap',
  server: {
    port: 9741
  },
  // y-prosemirror does `instanceof Y.Doc` checks against the Yjs constructor
  // it imported; if the bundler ends up with two Yjs copies (one pulled in by
  // @hocuspocus/provider, another by @tiptap/extension-collaboration via
  // y-prosemirror), the check fails inside createDecorations with
  // "Cannot read properties of undefined (reading 'doc')". Deduping forces a
  // single Yjs instance across the bundle.
  resolve: {
    dedupe: ['yjs', 'y-prosemirror', 'y-protocols']
  }
})
