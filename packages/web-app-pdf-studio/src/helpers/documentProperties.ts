import { PDFDateString, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'

// Like the PDF.js viewer (PDFDocumentProperties): inches for these locales, millimeters else.
const NON_METRIC_LOCALES = ['en-us', 'en-lr', 'my']
const US_PAGE_NAMES: Record<string, string> = { '8.5x11': 'Letter', '8.5x14': 'Legal' }
const METRIC_PAGE_NAMES: Record<string, string> = { '297x420': 'A3', '210x297': 'A4' }

export type PageSize = {
  width: number
  height: number
  unit: 'in' | 'mm'
  isPortrait: boolean
  /** E.g. A4, if it's a standard size. */
  name?: string
}

export type DocumentProperties = {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creationDate?: Date
  modificationDate?: Date
  creator?: string
  producer?: string
  version?: string
  pageCount: number
  pageSize?: PageSize
  isLinearized: boolean
}

type DocumentInfo = {
  Title?: string
  Author?: string
  Subject?: string
  Keywords?: string
  CreationDate?: string
  ModDate?: string
  Creator?: string
  Producer?: string
  PDFFormatVersion?: string
  IsLinearized?: boolean
}

type Size = { width: number; height: number }

function getPageName(size: Size, isPortrait: boolean, names: Record<string, string>) {
  const [width, height] = isPortrait ? [size.width, size.height] : [size.height, size.width]
  return names[`${width}x${height}`]
}

function getMetricSize(inches: Size, isPortrait: boolean): { size: Size; name?: string } {
  const size = {
    width: Math.round(inches.width * 25.4 * 10) / 10,
    height: Math.round(inches.height * 25.4 * 10) / 10
  }
  const name = getPageName(size, isPortrait, METRIC_PAGE_NAMES)
  if (name) {
    return { size, name }
  }
  // A4 and others in points are often a fraction of a millimeter off.
  const rounded = { width: Math.round(size.width), height: Math.round(size.height) }
  const isClose =
    Math.abs(inches.width * 25.4 - rounded.width) < 0.1 &&
    Math.abs(inches.height * 25.4 - rounded.height) < 0.1
  const roundedName = isClose ? getPageName(rounded, isPortrait, METRIC_PAGE_NAMES) : undefined
  if (!roundedName) {
    return { size }
  }
  return { size: rounded, name: roundedName }
}

/**
 * The size of a page as the PDF.js viewer shows it, turned by the rotation of the view. Like
 * the PDF.js viewer, the unit depends on the browser's locale (e.g. navigator.language).
 */
export function getPageSize(page: PDFPageProxy, rotation: number, locale: string): PageSize {
  const [x1, y1, x2, y2] = page.view
  const isTurned = (page.rotate + rotation) % 180 !== 0
  const width = ((x2 - x1) / 72) * page.userUnit
  const height = ((y2 - y1) / 72) * page.userUnit
  const inches = isTurned ? { width: height, height: width } : { width, height }
  const isPortrait = inches.width <= inches.height
  const sizeInches = {
    width: Math.round(inches.width * 100) / 100,
    height: Math.round(inches.height * 100) / 100
  }
  const metric = getMetricSize(inches, isPortrait)
  const name = getPageName(sizeInches, isPortrait, US_PAGE_NAMES) || metric.name
  if (NON_METRIC_LOCALES.includes(locale.toLowerCase())) {
    return { ...sizeInches, unit: 'in', isPortrait, name }
  }
  return { ...metric.size, unit: 'mm', isPortrait, name }
}

function parseDate(metadataDate: string | undefined, infoDate: string | undefined) {
  const time = metadataDate ? Date.parse(metadataDate) : NaN
  return Number.isNaN(time) ? (PDFDateString.toDateObject(infoDate) ?? undefined) : new Date(time)
}

/** The properties of the document, like the PDF.js viewer reads them: XMP first, then /Info. */
export async function getDocumentProperties(
  doc: PDFDocumentProxy,
  { pageNumber, rotation, locale }: { pageNumber: number; rotation: number; locale: string }
): Promise<DocumentProperties> {
  const { info, metadata } = (await doc.getMetadata()) as {
    info: DocumentInfo
    metadata: { get(name: string): string | string[] | undefined } | null
  }
  function fromXmp(name: string) {
    const value = metadata?.get(name)
    return Array.isArray(value) ? value.join('\n') : value
  }
  function text(xmpName: string, infoName: keyof Omit<DocumentInfo, 'IsLinearized'>) {
    return fromXmp(xmpName) || info[infoName] || undefined
  }
  const pageSize = await doc
    .getPage(pageNumber)
    .then((page) => getPageSize(page, rotation, locale))
    .catch((): undefined => undefined)
  return {
    title: text('dc:title', 'Title'),
    author: text('dc:creator', 'Author'),
    subject: text('dc:subject', 'Subject'),
    keywords: text('pdf:keywords', 'Keywords'),
    creationDate: parseDate(fromXmp('xmp:createdate'), info.CreationDate),
    modificationDate: parseDate(fromXmp('xmp:modifydate'), info.ModDate),
    creator: text('xmp:creatortool', 'Creator'),
    producer: text('pdf:producer', 'Producer'),
    version: info.PDFFormatVersion,
    pageCount: doc.numPages,
    pageSize,
    isLinearized: !!info.IsLinearized
  }
}
