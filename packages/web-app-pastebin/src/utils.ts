import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { formatDateFromJSDate } from '@opencloud-eu/web-pkg'

export const PASTEBIN_BASE_PATH = '/.space/pastebin'
export const MANIFEST_FILENAME = 'manifest.json'
export const REVISIONS_DIR = 'revisions'
export const DEFAULT_FILENAME = 'untitled.txt'
export const FILE_EXTENSION = 'pastebin'

export interface PastebinManifest {
  title: string
}

export function parsePastebinName(name: string): { timestamp: string; title: string } {
  const stripped = name.replace(`.${FILE_EXTENSION}`, '')
  const match = stripped.match(/^(\d{4}-\d{2}-\d{2}T[\d-]+Z)(?:-(.+))?$/)
  if (match) {
    return {
      timestamp: match[1],
      title: match[2]?.replace(/-/g, ' ') || ''
    }
  }
  return { timestamp: '', title: '' }
}

export function slugify(text: string): string {
  return text
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
}

export function formatDate(date: string, language: string): string {
  return formatDateFromJSDate(new Date(date), language)
}

export function displayName(name: string, language: string): string {
  const { title, timestamp } = parsePastebinName(name)
  if (title) return title
  if (timestamp) {
    try {
      const isoDate = timestamp
        .replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z')
        .replace(/T(\d{2})-/, 'T$1:')
      return formatDateFromJSDate(new Date(isoDate), language)
    } catch {
      return timestamp
    }
  }
  return name
}

export async function ensurePastebinFolders(webdav: WebDAV, space: SpaceResource): Promise<void> {
  try {
    await webdav.createFolder(space, { path: '/.space' })
  } catch {
    // may already exist
  }
  try {
    await webdav.createFolder(space, { path: PASTEBIN_BASE_PATH })
  } catch {
    // may already exist
  }
}

export async function loadManifest(
  webdav: WebDAV,
  space: SpaceResource,
  folderPath: string
): Promise<PastebinManifest | null> {
  try {
    const resp = await webdav.getFileContents(space, {
      path: `${folderPath}/${MANIFEST_FILENAME}`
    })
    return JSON.parse(resp.body)
  } catch {
    return null
  }
}

export interface RevisionLoadResult {
  files: Resource[]
  revisionPath: string | null
}

export async function loadRevisionFiles(
  webdav: WebDAV,
  space: SpaceResource,
  resourcePath: string,
  children: Resource[]
): Promise<RevisionLoadResult> {
  const revisionsFolder = children.find((c) => c.isFolder && c.name === REVISIONS_DIR)
  if (revisionsFolder) {
    const revPath = `${resourcePath}/${REVISIONS_DIR}/0`
    const { children: revFiles } = await webdav.listFiles(space, { path: revPath })
    return { files: revFiles.filter((r) => !r.isFolder), revisionPath: revPath }
  }
  return {
    files: children.filter((c) => !c.isFolder && c.name !== MANIFEST_FILENAME),
    revisionPath: null
  }
}

/**
 * Scrolls to the file element identified by data-item-id within its overflow container
 * and updates the URL's scrollTo query param to keep the URL in sync.
 */
export function scrollToFile(name: string): void {
  const el = document.querySelector(`[data-item-id='${CSS.escape(name)}']`) as HTMLElement
  if (!el) return

  const url = new URL(window.location.href)
  url.searchParams.set('scrollTo', name)
  window.history.replaceState({}, '', url.toString())

  const scrollContainer = el.closest('.ext\\:overflow-y-auto') as HTMLElement
  if (scrollContainer) {
    const offset = el.offsetTop - scrollContainer.offsetTop - 24
    scrollContainer.scrollTo({ top: offset, behavior: 'smooth' })
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
