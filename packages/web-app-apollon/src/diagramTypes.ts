import type { UMLDiagramType } from '@tumaet/apollon'
import activityDiagram from './assets/diagram-types/activity-diagram.svg?no-inline'
import bpmn from './assets/diagram-types/bpmn.svg?no-inline'
import classDiagram from './assets/diagram-types/class-diagram.svg?no-inline'
import communicationDiagram from './assets/diagram-types/communication-diagram.svg?no-inline'
import componentDiagram from './assets/diagram-types/component-diagram.svg?no-inline'
import deploymentDiagram from './assets/diagram-types/deployment-diagram.svg?no-inline'
import flowchart from './assets/diagram-types/flowchart.svg?no-inline'
import objectDiagram from './assets/diagram-types/object-diagram.svg?no-inline'
import petriNet from './assets/diagram-types/petri-net.svg?no-inline'
import reachabilityGraph from './assets/diagram-types/reachability-graph.svg?no-inline'
import sequentialFunctionChart from './assets/diagram-types/sequential-function-chart.svg?no-inline'
import syntaxTree from './assets/diagram-types/syntax-tree.svg?no-inline'
import useCaseDiagram from './assets/diagram-types/use-case-diagram.svg?no-inline'

export interface DiagramTypeEntry {
  type: UMLDiagramType
  name: string
  description: string
  image: string
}

export interface DiagramTypeGroup {
  id: string
  title: string
  types: DiagramTypeEntry[]
}

export function diagramTypeGroups($gettext: (msgid: string) => string): DiagramTypeGroup[] {
  return [
    {
      id: 'uml-structure',
      title: $gettext('UML structure'),
      types: [
        {
          type: 'ClassDiagram',
          name: $gettext('Class diagram'),
          description: $gettext('Classes, attributes and their relationships'),
          image: classDiagram
        },
        {
          type: 'ObjectDiagram',
          name: $gettext('Object diagram'),
          description: $gettext('Instances and links at one moment'),
          image: objectDiagram
        },
        {
          type: 'ComponentDiagram',
          name: $gettext('Component diagram'),
          description: $gettext('Modules and their interfaces'),
          image: componentDiagram
        },
        {
          type: 'DeploymentDiagram',
          name: $gettext('Deployment diagram'),
          description: $gettext('Software mapped onto hardware nodes'),
          image: deploymentDiagram
        }
      ]
    },
    {
      id: 'uml-behavior',
      title: $gettext('UML behavior'),
      types: [
        {
          type: 'ActivityDiagram',
          name: $gettext('Activity diagram'),
          description: $gettext('Actions, decisions and control flow'),
          image: activityDiagram
        },
        {
          type: 'UseCaseDiagram',
          name: $gettext('Use case diagram'),
          description: $gettext('Actors and what they can do'),
          image: useCaseDiagram
        },
        {
          type: 'CommunicationDiagram',
          name: $gettext('Communication diagram'),
          description: $gettext('Messages between objects'),
          image: communicationDiagram
        }
      ]
    },
    {
      id: 'petri-nets',
      title: $gettext('Petri nets'),
      types: [
        {
          type: 'PetriNet',
          name: $gettext('Petri net'),
          description: $gettext('Places, transitions and tokens'),
          image: petriNet
        },
        {
          type: 'ReachabilityGraph',
          name: $gettext('Reachability graph'),
          description: $gettext('All states a net can reach'),
          image: reachabilityGraph
        }
      ]
    },
    {
      id: 'process-and-logic',
      title: $gettext('Process and logic'),
      types: [
        {
          type: 'Flowchart',
          name: $gettext('Flowchart'),
          description: $gettext('Steps and decisions of a process'),
          image: flowchart
        },
        {
          type: 'BPMN',
          name: $gettext('BPMN'),
          description: $gettext('Business processes in pools and lanes'),
          image: bpmn
        },
        {
          type: 'Sfc',
          name: $gettext('Sequential function chart'),
          description: $gettext('Steps and transitions of a controller'),
          image: sequentialFunctionChart
        },
        {
          type: 'SyntaxTree',
          name: $gettext('Syntax tree'),
          description: $gettext('Structure of an expression or sentence'),
          image: syntaxTree
        }
      ]
    }
  ]
}

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term)
}

export function filterDiagramTypeGroups(
  groups: DiagramTypeGroup[],
  filterTerm: string
): DiagramTypeGroup[] {
  const term = filterTerm.trim().toLowerCase()
  if (!term) {
    return groups
  }
  return groups
    .map((group) => {
      if (includesTerm(group.title, term)) {
        return group
      }
      return {
        ...group,
        types: group.types.filter(
          ({ name, description }) => includesTerm(name, term) || includesTerm(description, term)
        )
      }
    })
    .filter((group) => group.types.length)
}
