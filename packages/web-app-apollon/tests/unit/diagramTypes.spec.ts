import type { UMLDiagramType } from '@tumaet/apollon'
import { diagramTypeGroups, filterDiagramTypeGroups } from '../../src/diagramTypes'

const allTypes = Object.keys({
  ClassDiagram: true,
  ObjectDiagram: true,
  ActivityDiagram: true,
  UseCaseDiagram: true,
  CommunicationDiagram: true,
  ComponentDiagram: true,
  DeploymentDiagram: true,
  PetriNet: true,
  ReachabilityGraph: true,
  SyntaxTree: true,
  Flowchart: true,
  BPMN: true,
  Sfc: true
} satisfies Record<UMLDiagramType, true>)

const groups = diagramTypeGroups((msgid) => msgid)

function filteredTypes(term: string) {
  return filterDiagramTypeGroups(groups, term).flatMap((group) =>
    group.types.map(({ type }) => type)
  )
}

describe('diagramTypeGroups', () => {
  it('offers every diagram type exactly once', () => {
    const types = groups.flatMap((group) => group.types.map(({ type }) => type))

    expect(types).toHaveLength(allTypes.length)
    expect(new Set(types)).toEqual(new Set(allTypes))
  })
})

describe('filterDiagramTypeGroups', () => {
  it.each(['', '   '])('returns all groups for the term "%s"', (term) => {
    expect(filterDiagramTypeGroups(groups, term)).toEqual(groups)
  })

  it('matches names case-insensitively', () => {
    expect(filteredTypes('CLASS')).toEqual(['ClassDiagram'])
  })

  it('matches descriptions', () => {
    expect(filteredTypes('tokens')).toEqual(['PetriNet'])
  })

  it('keeps a whole group when its title matches', () => {
    const result = filterDiagramTypeGroups(groups, 'uml')

    expect(result.map(({ id }) => id)).toEqual(['uml-structure', 'uml-behavior'])
    expect(result.flatMap((group) => group.types)).toHaveLength(7)
  })

  it('hides groups without matches', () => {
    expect(filterDiagramTypeGroups(groups, 'tokens').map(({ id }) => id)).toEqual(['petri-nets'])
  })

  it('does not match across the name and the description', () => {
    expect(filteredTypes('net places')).toEqual([])
  })

  it('returns no groups when nothing matches', () => {
    expect(filterDiagramTypeGroups(groups, 'zzz')).toEqual([])
  })
})
