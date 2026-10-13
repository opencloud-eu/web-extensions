import type { UMLDiagramType } from '@tumaet/apollon'

type Gettext = (msgid: string) => string

export function diagramTypeEntries($gettext: Gettext): [UMLDiagramType, string][] {
  const names: Record<UMLDiagramType, string> = {
    ClassDiagram: $gettext('Class diagram'),
    ObjectDiagram: $gettext('Object diagram'),
    ActivityDiagram: $gettext('Activity diagram'),
    UseCaseDiagram: $gettext('Use case diagram'),
    CommunicationDiagram: $gettext('Communication diagram'),
    ComponentDiagram: $gettext('Component diagram'),
    DeploymentDiagram: $gettext('Deployment diagram'),
    PetriNet: $gettext('Petri net'),
    ReachabilityGraph: $gettext('Reachability graph'),
    SyntaxTree: $gettext('Syntax tree'),
    Flowchart: $gettext('Flowchart'),
    BPMN: $gettext('BPMN'),
    Sfc: $gettext('Sequential function chart')
  }
  return Object.entries(names) as [UMLDiagramType, string][]
}
