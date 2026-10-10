import { mock } from 'vitest-mock-extended'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getInitialView } from '../../../src/helpers/initialView'

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({ SpreadMode: { NONE: 0, ODD: 1, EVEN: 2 } }))

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
    ['TwoColumnLeft', 1],
    ['TwoPageLeft', 1],
    ['TwoColumnRight', 2],
    ['TwoPageRight', 2],
    ['SinglePage', undefined]
  ])('shows pages side by side for page layout %s', async (pageLayout, spreadMode) => {
    expect((await getInitialView(createDocument(null, pageLayout))).spreadMode).toBe(spreadMode)
  })
})
