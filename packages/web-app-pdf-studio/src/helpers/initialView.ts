import type { PDFDocumentProxy } from 'pdfjs-dist'
import { SpreadMode } from 'pdfjs-dist/web/pdf_viewer.mjs'

export type SidebarView = 'pages' | 'outline' | 'attachments' | 'layers'

// Same mapping as the PDF.js viewer.
const SIDEBAR_VIEWS: Record<string, SidebarView> = {
  UseThumbs: 'pages',
  UseOutlines: 'outline',
  UseAttachments: 'attachments',
  UseOC: 'layers'
}
const SPREAD_MODES: Record<string, number> = {
  TwoColumnLeft: SpreadMode.ODD,
  TwoPageLeft: SpreadMode.ODD,
  TwoColumnRight: SpreadMode.EVEN,
  TwoPageRight: SpreadMode.EVEN
}

/**
 * What the PDF asks for when it is opened (its page mode and layout), as far as the PDF.js
 * viewer follows it: the sidebar view and pages side by side.
 */
export async function getInitialView(doc: PDFDocumentProxy) {
  const [pageMode, pageLayout] = await Promise.all([doc.getPageMode(), doc.getPageLayout()])
  return { sidebarView: SIDEBAR_VIEWS[pageMode], spreadMode: SPREAD_MODES[pageLayout] }
}
