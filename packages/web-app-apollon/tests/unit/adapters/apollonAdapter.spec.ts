import * as Y from 'yjs'
import { createDiagram, makeApollonAdapter } from '../../../src/adapters/apollonAdapter'

const adapter = makeApollonAdapter()

function model(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '4.2.0',
    id: 'diagram-1',
    title: 'Orders',
    type: 'ClassDiagram',
    nodes: [
      {
        id: 'class-1',
        type: 'class',
        width: 160,
        height: 100,
        position: { x: 10, y: 20 },
        data: { name: 'Order', methods: [], attributes: [] },
        measured: { width: 160, height: 100 }
      }
    ],
    edges: [],
    assessments: {},
    ...overrides
  }
}

function roundTrip(content: string) {
  const ydoc = new Y.Doc()
  adapter.hydrate(ydoc, content)
  return adapter.serialize(ydoc) as string
}

describe('apollon adapter', () => {
  it('reports an empty document as having no content', () => {
    expect(adapter.hasContent(new Y.Doc())).toBe(false)
  })

  it('keeps an empty file empty, so a new file waits for its diagram type', () => {
    const ydoc = new Y.Doc()

    adapter.hydrate(ydoc, '')

    expect(adapter.hasContent(ydoc)).toBe(false)
    expect(adapter.serialize(ydoc)).toBe('')
  })

  it('returns the diagram of a file in a round trip', () => {
    const parsed = JSON.parse(roundTrip(JSON.stringify(model())))

    expect(parsed.id).toBe('diagram-1')
    expect(parsed.title).toBe('Orders')
    expect(parsed.type).toBe('ClassDiagram')
    expect(parsed.nodes).toEqual(model().nodes)
  })

  it('writes the bare model, indented with two spaces and a trailing newline', () => {
    const content = roundTrip(JSON.stringify(model()))

    expect(content.startsWith('{\n  "')).toBe(true)
    expect(content.endsWith('}\n')).toBe(true)
    expect(JSON.parse(content).model).toBeUndefined()
  })

  it('serializes to the same content on every round trip', () => {
    const first = roundTrip(JSON.stringify(model()))

    expect(roundTrip(first)).toBe(first)
  })

  it('reads a file that wraps the model under a "model" key', () => {
    const parsed = JSON.parse(roundTrip(JSON.stringify({ name: 'legacy', model: model() })))

    expect(parsed.title).toBe('Orders')
    expect(parsed.nodes).toHaveLength(1)
  })

  it('migrates a file written by an older Apollon version', () => {
    const legacy = {
      id: 'legacy-1',
      title: 'Legacy',
      model: {
        version: '3.0.0',
        type: 'ClassDiagram',
        size: { width: 800, height: 600 },
        interactive: { elements: {}, relationships: {} },
        elements: {
          'el-1': {
            id: 'el-1',
            name: 'Order',
            type: 'Class',
            owner: null as string | null,
            bounds: { x: 10, y: 20, width: 200, height: 100 }
          }
        },
        relationships: {},
        assessments: {}
      }
    }

    const parsed = JSON.parse(roundTrip(JSON.stringify(legacy)))

    expect(parsed.version.startsWith('4.')).toBe(true)
    expect(parsed.type).toBe('ClassDiagram')
    expect(parsed.nodes.map(({ id }: { id: string }) => id)).toEqual(['el-1'])
  })

  it('gives a file without an id one, so every peer reads the same', () => {
    const ydoc = new Y.Doc()
    adapter.hydrate(ydoc, JSON.stringify(model({ id: undefined })))

    const first = JSON.parse(adapter.serialize(ydoc) as string).id
    const second = JSON.parse(adapter.serialize(ydoc) as string).id

    expect(first).toBeTruthy()
    expect(second).toBe(first)
  })

  it('refuses an unparseable file instead of opening a blank canvas', () => {
    const ydoc = new Y.Doc()

    expect(() => adapter.hydrate(ydoc, 'not json at all')).toThrow()
    expect(adapter.hasContent(ydoc)).toBe(false)
  })

  it('refuses JSON that is not an Apollon model', () => {
    const ydoc = new Y.Doc()

    expect(() => adapter.hydrate(ydoc, JSON.stringify({ hello: 'world' }))).toThrow()
    expect(adapter.hasContent(ydoc)).toBe(false)
  })

  it('does not hydrate over a diagram that is already there', () => {
    const ydoc = new Y.Doc()
    adapter.hydrate(ydoc, JSON.stringify(model()))

    adapter.hydrate(ydoc, JSON.stringify(model({ title: 'Other' })))

    expect(JSON.parse(adapter.serialize(ydoc) as string).title).toBe('Orders')
  })

  it('has no content after a reset and leaves foreign shared types alone', () => {
    const ydoc = new Y.Doc()
    ydoc.getMap('_oc_meta').set('etag', 'abc')
    adapter.hydrate(ydoc, JSON.stringify(model()))

    adapter.reset!(ydoc)

    expect(adapter.hasContent(ydoc)).toBe(false)
    expect(ydoc.getMap('_oc_meta').get('etag')).toBe('abc')
  })

  it('creates an empty diagram of the chosen type', () => {
    const ydoc = new Y.Doc()

    createDiagram(ydoc, 'ActivityDiagram', 'Checkout')
    const parsed = JSON.parse(adapter.serialize(ydoc) as string)

    expect(adapter.hasContent(ydoc)).toBe(true)
    expect(parsed.type).toBe('ActivityDiagram')
    expect(parsed.title).toBe('Checkout')
    expect(parsed.nodes).toEqual([])
    expect(parsed.id).toBeTruthy()
  })

  it('keeps the first diagram when a type is chosen a second time', () => {
    const ydoc = new Y.Doc()
    createDiagram(ydoc, 'ActivityDiagram', 'Checkout')

    createDiagram(ydoc, 'ClassDiagram', 'Checkout')

    expect(JSON.parse(adapter.serialize(ydoc) as string).type).toBe('ActivityDiagram')
  })
})
