import { mock } from 'vitest-mock-extended'
import type { PDFDocumentProxy } from 'pdfjs-dist'
// pdf_viewer.mjs takes PDF.js from globalThis.pdfjsLib, which pdfjs-dist sets when imported.
import 'pdfjs-dist'
import { SpreadMode } from 'pdfjs-dist/web/pdf_viewer.mjs'
import { getInitialView } from '../../../src/helpers/initialView'

function createDocument(pageMode: string | null, pageLayout: string) {
  return mock<PDFDocumentProxy>({
    getPageMode: vi.fn().mockResolvedValue(pageMode),
    getPageLayout: vi.fn().mockResolvedValue(pageLayout)
  })
}

describe('getInitialView', () => {
  it.each([
    ['UseThumbs', 'pages'],
    ['UseOutlines', 'outline'],
    ['UseAttachments', 'attachments'],
    ['UseOC', 'layers'],
    ['UseNone', undefined],
    [null, undefined]
  ])('opens the sidebar for page mode %s with %s', async (pageMode, sidebarView) => {
    expect((await getInitialView(createDocument(pageMode, ''))).sidebarView).toBe(sidebarView)
  })

  it.each([
    ['TwoColumnLeft', SpreadMode.ODD],
    ['TwoPageLeft', SpreadMode.ODD],
    ['TwoColumnRight', SpreadMode.EVEN],
    ['TwoPageRight', SpreadMode.EVEN],
    ['SinglePage', undefined]
  ])('shows pages side by side for page layout %s', async (pageLayout, spreadMode) => {
    expect((await getInitialView(createDocument(null, pageLayout))).spreadMode).toBe(spreadMode)
  })
})
