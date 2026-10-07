# web-app-apollon

Collaborative UML diagrams in OpenCloud Web, built on the
[Apollon](https://github.com/ls1intum/Apollon) editor. Registers for the `.apollon` file
extension, can create new diagrams from the "New" menu, and opens read-only for users without
write access.

A new diagram starts with a choice of diagram type (class, activity, use case, component,
deployment and more). The type of an existing diagram cannot be changed.

## File format

A `.apollon` file holds the Apollon model as JSON, the same format the Apollon VS Code extension
reads and writes. Files from older Apollon versions are migrated when they are saved.

## Requirements

The app takes its Yjs runtime from OpenCloud Web instead of bundling its own, see the
[Excalidraw app](../web-app-excalidraw/README.md#requirements) for the details. It needs an
OpenCloud whose Web is 8.1.0 or newer.

## Setup for collaboration

The same as for the [Excalidraw app](../web-app-excalidraw/README.md#setup-for-collaboration).
Without a Yjs server the app still works, each user then edits on their own.

## Known limitations

- Two users changing the same element at the same time: the last change wins. Changes to
  different elements are merged.
- Apollon's own labels are English only.
