/**
 * Album file format: a `.album` file whose JSON content is the single source
 * of truth. The title is the file name without extension, sorting is mtime.
 * The `query` is a bare KQL string executed in the viewer's own context, so
 * visibility is always query result ∩ the viewer's read permissions.
 */

export const ALBUM_EXTENSION = 'album'
export const ALBUMS_DIR = '.space/photos/albums'
export const ALBUM_FORMAT_VERSION = 1

export interface AlbumFile {
  version: number
  query: string
  /** unknown fields from newer versions are preserved on write, never dropped */
  [key: string]: unknown
}

/** A `.album` file found via search, enough to locate and open it */
export interface AlbumRef {
  title: string
  fileName: string
  parentPath: string
  driveId: string
  id?: string
  mtime?: string
}

export function albumTitle(fileName: string): string {
  return fileName.replace(new RegExp(`\\.${ALBUM_EXTENSION}$`), '')
}

export function parseAlbumFile(content: string): AlbumFile {
  const parsed: unknown = JSON.parse(content)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('album file is not a JSON object')
  }
  const file = parsed as Record<string, unknown>
  if (typeof file.version !== 'number') {
    throw new Error('album file has no version')
  }
  if (typeof file.query !== 'string') {
    throw new Error('album file has no query')
  }
  return file as AlbumFile
}

export function serializeAlbumFile(file: AlbumFile): string {
  return JSON.stringify(file, null, 2) + '\n'
}

/** clients reading a higher major version must open the album read-only */
export function isReadOnlyVersion(file: AlbumFile): boolean {
  return file.version > ALBUM_FORMAT_VERSION
}
