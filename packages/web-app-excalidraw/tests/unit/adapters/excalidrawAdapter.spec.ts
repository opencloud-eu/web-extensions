import * as Y from 'yjs'
import {
  makeExcalidrawAdapter,
  observeAppState,
  readAppState,
  writeAppState
} from '../../../src/adapters/excalidrawAdapter'

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

  it('refuses an unparseable file instead of opening a blank canvas', () => {
    const ydoc = new Y.Doc()

    expect(() => adapter.hydrate(ydoc, 'not json at all')).toThrow()
    expect(adapter.hasContent(ydoc)).toBeFalsy()
  })

  it('treats an empty file as an empty scene', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, '')

    expect(adapter.hasContent(ydoc)).toBeTruthy()
    expect(ydoc.getArray('elements').length).toBe(0)
  })

  it('still has content after the user emptied the board', () => {
    const ydoc = new Y.Doc()
    adapter.hydrate(ydoc, file({ elements: [element('a')] }))

    const yElements = ydoc.getArray('elements')
    yElements.delete(0, yElements.length)

    expect(adapter.hasContent(ydoc)).toBeTruthy()
    expect(JSON.parse(adapter.serialize(ydoc) as string).elements).toEqual([])
  })

  it('keeps the scene settings of the file in a round trip', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(
      ydoc,
      file({ elements: [], appState: { viewBackgroundColor: '#123456', gridSize: 20 } })
    )

    expect(JSON.parse(adapter.serialize(ydoc) as string).appState).toEqual({
      viewBackgroundColor: '#123456',
      gridSize: 20
    })
  })

  it('keeps only the document level scene settings, not the viewer state', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(
      ydoc,
      file({
        elements: [],
        appState: { viewBackgroundColor: '#123456', scrollX: 400, selectedElementIds: { a: true } }
      })
    )

    expect(readAppState(ydoc)).toEqual({ viewBackgroundColor: '#123456', gridSize: null })
  })

  it('shares a scene setting the local user changed', () => {
    const ydoc = new Y.Doc()
    adapter.hydrate(ydoc, file({ elements: [] }))
    const onRemoteChange = vi.fn()
    observeAppState(ydoc, onRemoteChange)

    writeAppState(ydoc, { viewBackgroundColor: '#abcdef', scrollX: 400 })

    expect(readAppState(ydoc).viewBackgroundColor).toBe('#abcdef')
    // Local writes are the editor's own change, it does not need to hear them back.
    expect(onRemoteChange).not.toHaveBeenCalled()
  })

  it('ignores a change that leaves the scene settings as they are', () => {
    const ydoc = new Y.Doc()
    adapter.hydrate(ydoc, file({ elements: [], appState: { viewBackgroundColor: '#abcdef' } }))
    const onUpdate = vi.fn()
    ydoc.on('update', onUpdate)

    writeAppState(ydoc, { viewBackgroundColor: '#abcdef', scrollX: 400, cursorButton: 'down' })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('notifies about a scene setting another client changed', () => {
    const local = new Y.Doc()
    const remote = new Y.Doc()
    adapter.hydrate(local, file({ elements: [] }))
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(local))
    const onRemoteChange = vi.fn()
    observeAppState(local, onRemoteChange)

    writeAppState(remote, { viewBackgroundColor: '#fedcba' })
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote))

    expect(onRemoteChange).toHaveBeenCalledWith({
      viewBackgroundColor: '#fedcba',
      gridSize: null
    })
  })

  it('falls back to the default scene settings for a file without any', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, '')

    expect(JSON.parse(adapter.serialize(ydoc) as string).appState).toEqual({
      viewBackgroundColor: '#ffffff',
      gridSize: null
    })
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

const file = ({
  elements,
  appState = {}
}: {
  elements: ReturnType<typeof element>[]
  appState?: Record<string, unknown>
}) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'test',
    elements,
    appState,
    files: { 'file-1': { id: 'file-1', mimeType: 'image/png', dataURL: 'data:image/png;base64,x' } }
  })
