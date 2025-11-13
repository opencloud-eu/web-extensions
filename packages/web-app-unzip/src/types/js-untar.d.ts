declare module 'js-untar' {
  export interface UntarFile {
    name: string
    mode: string
    uid: number
    gid: number
    size: number
    mtime: number
    checksum: number
    type: string
    linkname: string
    ustarFormat: string
    buffer: ArrayBuffer
    getBlobUrl: () => string
    readAsString: () => string
    readAsJSON: () => any
  }

  export default function untar(arrayBuffer: ArrayBuffer): Promise<UntarFile[]>
}
