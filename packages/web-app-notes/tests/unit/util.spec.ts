import {
  countFolders,
  countNotes,
  getNotebookPathLabel,
  getResourceLabel,
  searchNoteNodes
} from '../../src/util'

describe('notes presentation helpers', () => {
  const notebook = {
    isFolder: true,
    name: 'Product Docs.ocnb',
    path: '/Product Docs.ocnb'
  } as any

  const nestedFolder = {
    resource: {
      id: 'folder-1',
      isFolder: true,
      name: 'Architecture',
      path: '/Product Docs.ocnb/Architecture'
    },
    children: [
      {
        resource: {
          id: 'note-2',
          isFolder: false,
          name: 'ADR.md',
          path: '/Product Docs.ocnb/Architecture/ADR.md'
        }
      }
    ]
  } as any

  const tocNodes = [
    {
      resource: {
        id: 'note-1',
        isFolder: false,
        name: 'Overview.md',
        path: '/Product Docs.ocnb/Overview.md'
      }
    },
    nestedFolder
  ] as any

  it('counts folders and notes in the notebook tree', () => {
    expect(countNotes(tocNodes)).toBe(2)
    expect(countFolders(tocNodes)).toBe(1)
  })

  it('searches notes by their display label', () => {
    const results = searchNoteNodes(tocNodes, 'over')

    expect(results).toHaveLength(1)
    expect(results[0].resource.name).toBe('Overview.md')
  })

  it('formats notebook and path labels for display', () => {
    expect(getResourceLabel(notebook)).toBe('Product Docs')
    expect(getNotebookPathLabel(notebook, nestedFolder.children[0].resource)).toBe('Architecture')
  })
})