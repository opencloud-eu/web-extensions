import type * as Y from 'yjs'
import type { YjsAdapter } from '@opencloud-eu/web-pkg'
import type { UMLDiagramType } from '@tumaet/apollon'
import {
  clearModelFromYDoc,
  hasModelInYDoc,
  importDiagram,
  readModelFromYDoc,
  writeModelToYDoc,
  type UMLModel
} from '@tumaet/apollon/model'

const apollonAdapter: YjsAdapter = {
  hydrate(ydoc, content) {
    if (!content || !content.trim()) return
    if (hasModelInYDoc(ydoc)) return
    let model: UMLModel
    try {
      model = importDiagram(JSON.parse(content))
    } catch (e) {
      throw new Error(`"${content.slice(0, 32)}..." is not a valid Apollon file`, { cause: e })
    }
    // Peers read the id from the shared document, so a file without one gets it here
    // instead of each editor inventing its own.
    writeModelToYDoc(ydoc, { ...model, id: model.id || crypto.randomUUID() }, 'hydrate')
  },

  serialize(ydoc) {
    const model = readModelFromYDoc(ydoc)
    if (!model) return ''
    return `${JSON.stringify(model, null, 2)}\n`
  },

  hasContent(ydoc) {
    return hasModelInYDoc(ydoc)
  },

  reset(ydoc) {
    if (!hasModelInYDoc(ydoc)) return
    clearModelFromYDoc(ydoc, 'reset')
  }
}

export function makeApollonAdapter(): YjsAdapter {
  return apollonAdapter
}

export function createDiagram(ydoc: Y.Doc, type: UMLDiagramType, title: string) {
  if (hasModelInYDoc(ydoc)) return
  writeModelToYDoc(
    ydoc,
    {
      version: '4.0.0',
      id: crypto.randomUUID(),
      title,
      type,
      nodes: [],
      edges: [],
      assessments: {}
    },
    'create'
  )
}
