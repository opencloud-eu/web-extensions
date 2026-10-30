# web-app-pdf-studio

View and edit PDF files in OpenCloud Web, based on [PDF.js](https://mozilla.github.io/pdf.js/).
Registers for `.pdf` files next to the built-in PDF viewer, so it is available via "Open with".
It works like the PDF.js viewer in Firefox, in the OpenCloud look and theme.

## Features

- **Viewing:** page navigation with page labels, zoom, rotation, scroll and spread modes, full
  text search, printing, presentation mode and hand tool. The sidebar shows pages, outline,
  attachments and layers. The keyboard shortcuts are those of the PDF.js viewer.
- **Forms:** fill in AcroForm and XFA fields. Form scripts run in PDF.js' sandbox.
- **Annotations:** highlight, text, drawings, images from the device or the cloud, and
  signatures (drawn, typed or from an image; up to five saved in the browser).
- **Comments:** on text, highlights, drawings and images, with a list of all comments of the
  document. Existing comments, e.g. from Acrobat, can be read.
- **Pages:** delete and reorder pages, with undo and redo.
- **Password-protected PDFs** stay encrypted with their password when saved.
- **Document properties** in a panel of OpenCloud's right sidebar.

Changes are saved into the PDF via OpenCloud (save button, `Ctrl+S`). There is no autosave:
forms are often only filled in to print them. Read-only access shows the document without
editing tools.

## Requirements

OpenCloud Web 8.1 or newer. The app needs no configuration.

## CSP requirements

PDF.js runs its parser in a web worker served from the app's assets, so `worker-src` must allow
`'self'`, which the default OpenCloud CSP does. `script-src` should allow `'wasm-unsafe-eval'`.
Without it, form scripts don't run, and JPEG 2000/JBIG2 images and color profiles fall back to
slower or simpler decoding.

## Development notes

- `vite.config.ts` copies PDF.js' run-time assets (worker, sandbox, CMaps, fonts, ICC profiles,
  WebAssembly decoders) from `pdfjs-dist` into `dist/pdfjs`, `src/helpers/pdfjs.ts` points
  PDF.js at them.
- The build scopes the `:root` variables of `pdf_viewer.css` to the app's container, except the
  two that PDF.js reads from `document.documentElement`.
- `src/styles/pdfjs-integration.css` fixes PDF.js' UI where OpenCloud's global styles get in its
  way.
- PDF.js' `PDFHistory` is not used, it replaces `window.history.state`, which the router needs.
- PDF.js is only loaded once a PDF is opened (`App.vue` loads `PdfStudio.vue` asynchronously).
