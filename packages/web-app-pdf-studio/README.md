# web-app-pdf-studio

View and edit PDF files in OpenCloud Web, based on [PDF.js](https://mozilla.github.io/pdf.js/).
Registers for `.pdf` files next to the built-in PDF viewer, so it is available via "Open with".

## Features

- Viewing: page navigation (with the page labels of the document, e.g. i, ii, iii), zoom
  presets, rotation, scroll modes and pages side by side, thumbnails, full text search, printing (including filled-in forms and new annotations,
  with progress and cancel for long documents), a presentation mode (full screen, page by page),
  a hand tool to move the pages by dragging and the document properties, like in the PDF.js viewer
  (presentation mode and hand tool aren't offered on phones).
- Sidebar views like in the PDF.js viewer: pages, the document outline (with the pages of its
  entries and the current section), attachments, those of the document (e.g. the XML of an
  e-invoice) and of annotations, which can be downloaded, and layers (optional content) to show
  or hide.
- Keyboard and touch: like in the PDF.js viewer, `n`/`j` and `p`/`k` change the page, `Home`/`End`
  and `Ctrl` + `↑`/`↓` go to the first/last page, arrow keys turn pages where there is no
  horizontal scrollbar, `F4` toggles the sidebar,
  `+`/`-` and `Ctrl` + `+`/`-`/`0`, `Ctrl` + mouse wheel or pinching zoom, `r`/`R` rotate,
  `Ctrl` + `F` searches, `Ctrl` + `G` finds the next match (also with the find bar closed), `Ctrl` + `Z`/`Shift` + `Z` undo and
  redo, `Ctrl` + `Alt` + `P` presents, `Ctrl` + `Alt` + `G` selects the page number, `h`/`s` switch between the hand tool and text selection,
  and `Ctrl` + `S` saves.
- Forms: fill in AcroForm fields and save the values into the file. Form scripts (calculations,
  validation, …) run in PDF.js' sandbox. XFA forms can be filled in as well, but PDF.js can't
  add annotations to them or change their pages.
- Password-protected PDFs: the password is asked for when opening and kept in memory while the
  file is open, so the file stays encrypted with it when saving or changing pages.
- Annotations: highlight text, add text, draw, add images from the device or the cloud, and add
  signatures (drawn, typed or from an image, with a description; up to five can be saved in
  the browser for reuse, like in the PDF.js viewer).
  Clicking the active tool again ends it (the signature tool asks for a new signature instead),
  `Escape` finishes or deselects the current annotation and keeps the tool, like in the PDF.js
  viewer. Existing annotations can be
  selected, moved and changed with any tool (or by double-clicking saved ones); PDF.js' own
  toolbar on a selected annotation changes its color, deletes it or (for images) edits the
  image description. The settings of the active tool (color, size, thickness, …) change the
  selected annotation and are used for new ones.
- Comments: like in Firefox, comment on selected text or add a comment to a highlight, drawing or
  image via its toolbar. The comments tool lists all comments of the document. Comments are
  saved into the PDF. Existing ones (e.g. from Acrobat) can be read; they can be edited and
  removed where PDF.js saves the change (highlights, drawings, text and images).
- Pages: delete and reorder pages from the sidebar, undo and redo like other changes.
- Read-only access (e.g. view-only shares or links) shows the document without any editing tools.

Changes are written into the PDF itself and saved via OpenCloud (save button, `Ctrl+S`,
autosave). The file counts as changed right away, also while drawing or typing, and no longer
once all changes are undone. The app follows the OpenCloud light and dark theme, pages keep
their original colors. PDF.js' own texts (annotation toolbars, placeholders, labels for screen
readers) are translated like the rest of the app.

## Requirements

OpenCloud Web 8.1 or newer, the app uses design system components added in that version.

## Configuration

The app needs no configuration.

## CSP requirements

PDF.js runs its parser in a web worker that is served from the app's own assets, so
`worker-src` must allow `'self'`, which the default OpenCloud CSP does. `script-src` should allow `'wasm-unsafe-eval'`:

- Form scripts run in a WebAssembly sandbox. Without it, forms still work but their scripts
  (calculations, validation) don't run.
- Images in JPEG 2000 and JBIG2 format are decoded with WebAssembly, otherwise PDF.js falls back
  to slower JavaScript decoders.
- Color profiles (ICC) are applied with WebAssembly, otherwise PDF.js uses the plain device
  color space and images with a color profile may look slightly different.

## Development notes

- PDF.js loads its worker, form scripting sandbox, CMaps, standard fonts, ICC profiles,
  WebAssembly decoders and annotation icons at run time. `vite.config.ts` copies them from `pdfjs-dist` into `dist/pdfjs`,
  `src/helpers/pdfjs.ts` points PDF.js at them.
- `pdf_viewer.css` from PDF.js declares its variables and `color-scheme` on `:root`. The build
  scopes them to the app's container so they do not leak into the OpenCloud UI. The two
  variables PDF.js reads from `document.documentElement` in JavaScript stay on `:root`.
- `src/styles/pdfjs-integration.css` fixes PDF.js' own UI where OpenCloud's global styles get in
  its way (CSS reset, focus ring).
- PDF.js' `PDFHistory` (back/forward after following links) is not used: it replaces
  `window.history.state`, which OpenCloud's router relies on.
- PDF.js and its styles are only loaded once a PDF gets opened (`App.vue` loads
  `PdfStudio.vue` asynchronously).
