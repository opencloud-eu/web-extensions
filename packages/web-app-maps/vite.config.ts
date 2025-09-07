import { defineConfig } from '@opencloud-eu/extension-sdk'
import { viteStaticCopy } from 'vite-plugin-static-copy'

let assetsDest = 'assets'
if (process.env.OPENCLOUD_EXTENSION_DIST_DIR) {
  assetsDest = `${process.env.OPENCLOUD_EXTENSION_DIST_DIR}/assets`
}

export default defineConfig({
  name: 'maps',
  plugins: [
    viteStaticCopy({
      targets: [{ src: 'node_modules/leaflet-gpx/icons/pin-*.png', dest: assetsDest }]
    })
  ]
})
