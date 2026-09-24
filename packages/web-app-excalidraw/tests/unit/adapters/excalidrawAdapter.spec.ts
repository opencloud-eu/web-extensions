import * as Y from 'yjs'
import { makeExcalidrawAdapter } from '../../../src/adapters/excalidrawAdapter'

const adapter = makeExcalidrawAdapter()

describe('excalidraw adapter', () => {
  it('reports an empty document as having no content', () => {
    expect(adapter.hasContent(new Y.Doc())).toBeFalsy()
  })

  it('hydrates elements and assets from the file', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, file({ elements: [element('a'), element('b')] }))

    expect(adapter.hasContent(ydoc)).toBeTruthy()
    expect(ydoc.getArray('elements').length).toBe(2)
    expect(ydoc.getMap('assets').size).toBe(1)
  })

  it('keeps the element order in a round trip', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, file({ elements: [element('a'), element('b'), element('c')] }))
    const parsed = JSON.parse(adapter.serialize(ydoc) as string)

    expect(parsed.elements.map(({ id }: { id: string }) => id)).toEqual(['a', 'b', 'c'])
    expect(parsed.type).toBe('excalidraw')
  })

  it('serializes an empty document into a valid, empty scene', () => {
    const parsed = JSON.parse(adapter.serialize(new Y.Doc()) as string)

    expect(parsed.elements).toEqual([])
    expect(parsed.type).toBe('excalidraw')
  })

  it('ignores an unparseable file instead of throwing', () => {
    const ydoc = new Y.Doc()

    expect(() => adapter.hydrate(ydoc, 'not json at all')).not.toThrow()
    expect(adapter.hasContent(ydoc)).toBeFalsy()
  })

  it('treats an empty file as an empty scene', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, '')

    expect(adapter.hasContent(ydoc)).toBeFalsy()
  })

  it('does not hydrate twice into the same document', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, file({ elements: [element('a')] }))
    adapter.hydrate(ydoc, file({ elements: [element('b'), element('c')] }))

    expect(ydoc.getArray('elements').length).toBe(1)
  })

  it('wipes the document so stale recovery can re-seed it', () => {
    const ydoc = new Y.Doc()
    adapter.hydrate(ydoc, file({ elements: [element('a')] }))

    adapter.reset(ydoc)

    expect(adapter.hasContent(ydoc)).toBeFalsy()
    expect(ydoc.getMap('assets').size).toBe(0)

    adapter.hydrate(ydoc, file({ elements: [element('b')] }))
    expect(adapter.hasContent(ydoc)).toBeTruthy()
  })
})

const element = (id: string) => ({ id, type: 'rectangle', x: 0, y: 0, width: 10, height: 10 })

const file = ({ elements }: { elements: ReturnType<typeof element>[] }) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'test',
    elements,
    appState: {},
    files: { 'file-1': { id: 'file-1', mimeType: 'image/png', dataURL: 'data:image/png;base64,x' } }
  })
