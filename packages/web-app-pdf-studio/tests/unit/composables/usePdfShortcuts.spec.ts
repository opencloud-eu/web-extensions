import { ref } from 'vue'
import { getComposableWrapper } from '@opencloud-eu/web-test-helpers'
import { usePdfShortcuts, type PdfShortcutActions } from '../../../src/composables/usePdfShortcuts'

const mounted: { unmount: () => void }[] = []

const { TouchManager, screen } = vi.hoisted(() => ({
  TouchManager: vi.fn(),
  screen: { isMobile: { value: false } }
}))
vi.mock('pdfjs-dist', () => ({ TouchManager }))
vi.mock('@opencloud-eu/design-system/composables', () => ({ useIsMobile: () => screen }))

// happy-dom ignores the init values of WheelEvent.

function wheel(init: {
  deltaY: number
  deltaMode?: number
  ctrlKey?: boolean
  clientX?: number
  clientY?: number
}) {
  const event = new Event('wheel', { cancelable: true, bubbles: true })
  const defaults = { ctrlKey: false, metaKey: false, deltaX: 0, deltaZ: 0, deltaMode: 0 }
  for (const [key, value] of Object.entries({ ...defaults, ...init })) {
    Object.defineProperty(event, key, { value })
  }
  return event
}

function setup({
  isReadOnly = false,
  isPageFit = false,
  isPresenting = false,
  isFindBarOpen = false,
  isToolActive = false,
  editingStates = { hasSomethingToUndo: false, hasSomethingToRedo: false }
} = {}) {
  const root = document.createElement('div')
  const container = document.createElement('div')
  container.tabIndex = -1
  const input = document.createElement('input')
  const thumbnail = document.createElement('button')
  root.append(container, input, thumbnail)
  document.body.append(root)
  const actions = {
    save: vi.fn(),
    print: vi.fn(),
    present: vi.fn(),
    setHandTool: vi.fn(),
    toggleSidebar: vi.fn(),
    openFindBar: vi.fn(),
    closeFindBar: vi.fn(),
    selectPageNumber: vi.fn(),
    findAgain: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetZoom: vi.fn(),
    zoomAt: vi.fn(),
    panBy: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    handleEscape: vi.fn(),
    nextPage: vi.fn(),
    previousPage: vi.fn(),
    firstPage: vi.fn(),
    lastPage: vi.fn(),
    rotate: vi.fn()
  } satisfies PdfShortcutActions
  const wrapper = getComposableWrapper(() =>
    usePdfShortcuts({
      root: ref(root),
      container: ref(container),
      isReadOnly,
      isPresenting,
      isToolActive,
      editingStates,
      isPageFit,
      isFindBarOpen,
      scale: 1,
      actions
    })
  )
  mounted.push(wrapper)
  function press(target: EventTarget, init: KeyboardEventInit) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    target.dispatchEvent(event)
    return event
  }
  return { root, container, input, thumbnail, actions, press, wrapper }
}

describe('usePdfShortcuts', () => {
  afterEach(() => {
    mounted.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''
    screen.isMobile.value = false
  })

  describe('Escape', () => {
    function pressEscape(target: EventTarget) {
      const onParentKeydown = vi.fn()
      document.body.addEventListener('keydown', onParentKeydown)
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      target.dispatchEvent(event)
      document.body.removeEventListener('keydown', onParentKeydown)
      return { event, isForAppWrapper: onParentKeydown.mock.calls.length > 0 }
    }

    it('hands Escape in the pages over to the editing', () => {
      const { container, actions } = setup()
      const { event } = pressEscape(container)
      expect(actions.handleEscape).toHaveBeenCalledWith(event)
    })

    it('lets AppWrapper close read-only files', () => {
      const { container, actions } = setup({ isReadOnly: true })
      expect(pressEscape(container).isForAppWrapper).toBe(true)
      expect(actions.handleEscape).not.toHaveBeenCalled()
    })

    it('closes the find bar from anywhere in the app', () => {
      const { container, actions } = setup({ isFindBarOpen: true })
      expect(pressEscape(container).isForAppWrapper).toBe(false)
      expect(actions.closeFindBar).toHaveBeenCalled()
      expect(actions.handleEscape).not.toHaveBeenCalled()
    })

    it('ends the presentation mode, not the app', () => {
      const { container, actions } = setup({ isPresenting: true })
      expect(pressEscape(container).isForAppWrapper).toBe(false)
      expect(actions.handleEscape).not.toHaveBeenCalled()
    })

    // Its own Escape handling comes after AppWrapper's, which would close the app.
    it('closes a bottom drawer on small screens, not the app', () => {
      screen.isMobile.value = true
      const { container, actions } = setup()
      const drawer = document.createElement('div')
      drawer.className = 'oc-bottom-drawer'
      const closeButton = document.createElement('button')
      closeButton.className = 'oc-bottom-drawer-close-button'
      const onClose = vi.fn()
      closeButton.addEventListener('click', onClose)
      drawer.append(closeButton)
      document.body.append(drawer)
      expect(pressEscape(container).isForAppWrapper).toBe(false)
      expect(onClose).toHaveBeenCalled()
      expect(actions.handleEscape).not.toHaveBeenCalled()
    })
  })

  // E.g. after clicking a thumbnail or a toolbar button, otherwise they would keep the focus.
  it.each(['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown'])(
    'hands %s over to the pages to scroll them, like the PDF.js viewer',
    (key) => {
      const { container, thumbnail, actions, press } = setup()
      thumbnail.focus()
      const event = press(thumbnail, { key })
      expect(document.activeElement).toBe(container)
      // The browser scrolls the pages.
      expect(event.defaultPrevented).toBe(false)
      expect(actions.previousPage).not.toHaveBeenCalled()
    }
  )

  it('hands Space over to the pages, but lets it press a focused button', () => {
    const { root, container, thumbnail, actions, press } = setup({ isPageFit: true })
    thumbnail.focus()
    const buttonPress = press(thumbnail, { key: ' ' })
    expect(buttonPress.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(thumbnail)
    const link = document.createElement('a')
    link.href = '#'
    root.append(link)
    link.focus()
    press(link, { key: ' ' })
    expect(document.activeElement).toBe(container)
    expect(actions.nextPage).toHaveBeenCalledTimes(1)
  })

  it('leaves the arrow keys to menus', () => {
    const { root, container, press } = setup()
    const menuItem = document.createElement('button')
    const drop = document.createElement('div')
    drop.className = 'oc-drop'
    drop.append(menuItem)
    root.append(drop)
    menuItem.focus()
    press(menuItem, { key: 'ArrowDown' })
    expect(document.activeElement).not.toBe(container)
  })

  it.each([
    ['PageUp', 'previousPage'],
    ['PageDown', 'nextPage']
  ])('turns pages with %s when a page fits the screen', (key, action) => {
    const { container, actions, press } = setup({ isPageFit: true })
    const event = press(container, { key })
    expect(event.defaultPrevented).toBe(true)
    expect(actions[action as keyof PdfShortcutActions]).toHaveBeenCalled()
  })

  it('leaves PageUp in inputs alone', () => {
    const { input, container, press } = setup()
    input.focus()
    press(input, { key: 'PageUp' })
    expect(document.activeElement).not.toBe(container)
  })

  it.each([
    ['n', 'nextPage'],
    ['j', 'nextPage'],
    ['p', 'previousPage'],
    ['k', 'previousPage'],
    ['Home', 'firstPage'],
    ['End', 'lastPage'],
    ['+', 'zoomIn'],
    ['-', 'zoomOut']
  ])('handles "%s"', (key, action) => {
    const { root, actions, press } = setup()
    const event = press(root, { key })
    expect(actions[action as keyof PdfShortcutActions]).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('rotates with r and shift+r', () => {
    const { root, actions, press } = setup()
    press(root, { key: 'r' })
    press(root, { key: 'R', shiftKey: true })
    expect(actions.rotate.mock.calls).toEqual([[90], [-90]])
  })

  it('leaves keys alone while typing', () => {
    const { input, actions, press } = setup()
    const event = press(input, { key: 'n' })
    expect(actions.nextPage).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves keys alone outside the app, e.g. in a modal', () => {
    const { actions, press } = setup()
    const modal = document.createElement('div')
    document.body.append(modal)
    press(modal, { key: 'n' })
    press(modal, { key: '+', ctrlKey: true })
    const find = press(modal, { key: 'f', ctrlKey: true })
    expect(actions.nextPage).not.toHaveBeenCalled()
    expect(actions.zoomIn).not.toHaveBeenCalled()
    expect(actions.openFindBar).not.toHaveBeenCalled()
    expect(find.defaultPrevented).toBe(false)
  })

  it.each([
    ['+', 'zoomIn'],
    ['-', 'zoomOut'],
    ['0', 'resetZoom'],
    // The browser would print the OpenCloud page around the document.
    ['p', 'print']
  ])('handles ctrl+%s for the document instead of the page', (key, action) => {
    const { root, actions, press } = setup()
    const event = press(root, { key, ctrlKey: true })
    expect(actions[action as keyof PdfShortcutActions]).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('saves and finds with ctrl+s and ctrl+f, also while typing', () => {
    const { input, actions, press } = setup()
    press(input, { key: 's', ctrlKey: true })
    press(input, { key: 'f', metaKey: true })
    expect(actions.save).toHaveBeenCalled()
    expect(actions.openFindBar).toHaveBeenCalled()
  })

  it('does not save read-only files', () => {
    const { root, actions, press } = setup({ isReadOnly: true })
    const event = press(root, { key: 's', ctrlKey: true })
    expect(actions.save).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it.each([
    ['h', true],
    ['s', false]
  ])(
    'switches to the hand tool or text selection with %s, like the PDF.js viewer',
    (key, isHand) => {
      const { container, actions, press } = setup()
      press(container, { key })
      expect(actions.setHandTool).toHaveBeenCalledWith(isHand)
    }
  )

  it('starts the presentation mode with Ctrl+Alt+P, like the PDF.js viewer', () => {
    const { container, actions, press } = setup()
    const event = press(container, { key: 'π', code: 'KeyP', ctrlKey: true, altKey: true })
    expect(actions.present).toHaveBeenCalled()
    expect(actions.print).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('selects the page number with Ctrl+Alt+G, like the PDF.js viewer', () => {
    const { container, actions, press } = setup()
    const event = press(container, { key: '©', code: 'KeyG', ctrlKey: true, altKey: true })
    expect(actions.selectPageNumber).toHaveBeenCalled()
    expect(actions.findAgain).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it.each([
    [{ key: '+' }],
    [{ key: '-' }],
    [{ key: '=', ctrlKey: true }],
    [{ key: '-', ctrlKey: true }],
    [{ key: '0', ctrlKey: true }]
  ])('does not zoom while presenting, like the PDF.js viewer (%o)', (init) => {
    const { container, actions, press } = setup({ isPresenting: true })
    press(container, init)
    expect(actions.zoomIn).not.toHaveBeenCalled()
    expect(actions.zoomOut).not.toHaveBeenCalled()
    expect(actions.resetZoom).not.toHaveBeenCalled()
  })

  it.each([
    ['ArrowUp', 'firstPage'],
    ['ArrowDown', 'lastPage']
  ] as const)('goes to the first or last page with ctrl + %s from the toolbar', (key, action) => {
    const { container, thumbnail, actions, press } = setup()
    thumbnail.focus()
    const event = press(thumbnail, { key, ctrlKey: true })
    expect(actions[action]).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(container)
  })

  it('leaves ctrl + arrow keys alone while typing', () => {
    const { input, actions, press } = setup()
    const event = press(input, { key: 'ArrowUp', ctrlKey: true })
    expect(actions.firstPage).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('toggles the sidebar with F4, like the PDF.js viewer', () => {
    const { container, actions, press } = setup()
    press(container, { key: 'F4' })
    expect(actions.toggleSidebar).toHaveBeenCalled()
  })

  it('does not undo while presenting, like the PDF.js viewer', () => {
    const { container, actions, press } = setup({ isPresenting: true })
    press(container, { key: 'z', ctrlKey: true })
    expect(actions.undo).not.toHaveBeenCalled()
  })

  it('leaves the mouse wheel to the presentation mode while presenting', () => {
    const { container, actions } = setup({ isPresenting: true })
    container.dispatchEvent(
      wheel({ deltaY: -100, deltaMode: 1, ctrlKey: true, clientX: 0, clientY: 0 })
    )
    expect(actions.zoomAt).not.toHaveBeenCalled()
  })

  it('zooms around the pointer in steps with ctrl + mouse wheel', () => {
    const { container, actions } = setup()
    const event = wheel({ deltaY: -100, deltaMode: 1, ctrlKey: true, clientX: 10, clientY: 20 })
    container.dispatchEvent(event)
    container.dispatchEvent(
      wheel({ deltaY: 3, deltaMode: 1, ctrlKey: true, clientX: 0, clientY: 0 })
    )
    container.dispatchEvent(wheel({ deltaY: 100, deltaMode: 1 }))
    expect(actions.zoomAt.mock.calls).toEqual([
      [{ steps: 1 }, [10, 20]],
      [{ steps: -1 }, [0, 0]]
    ])
    expect(event.defaultPrevented).toBe(true)
  })

  // Trackpads send many small events per pinch, each one a zoom step would be far too fast.
  it('zooms continuously when pinching, like the PDF.js viewer', () => {
    const { container, actions } = setup()
    for (let i = 0; i < 10; i++) {
      container.dispatchEvent(wheel({ deltaY: -2, ctrlKey: true }))
    }
    const factor = actions.zoomAt.mock.calls.reduce(
      (total, [{ scaleFactor }]) => total * scaleFactor,
      1
    )
    expect(factor).toBeCloseTo(1.22, 1)
  })

  // PDF.js only handles them while a tool is active, the toolbar buttons work without.
  it.each([
    ['ArrowDown', false, 'nextPage'],
    [' ', false, 'nextPage'],
    [' ', true, 'previousPage'],
    ['ArrowUp', false, 'previousPage'],
    ['Backspace', false, 'previousPage']
  ] as const)('turns pages with "%s" (shift: %s) in page fit', (key, shiftKey, action) => {
    const { container, actions, press } = setup({ isPageFit: true })
    press(container, { key, shiftKey })
    expect(actions[action]).toHaveBeenCalled()
  })

  it('zooms the pages when pinching on touch screens, like the PDF.js viewer', () => {
    const { actions } = setup()
    const { onPinching, onPanning } = TouchManager.mock.lastCall[0]
    onPinching([10, 20], 100, 150, 1, 2)
    expect(actions.zoomAt).toHaveBeenCalledWith({ scaleFactor: 1.5 }, [10, 20], [1, 2])
    onPanning(3, 4)
    expect(actions.panBy).toHaveBeenCalledWith(3, 4)
  })

  it('finds the next and previous match with ctrl + g', () => {
    const { root, actions, press } = setup()
    press(root, { key: 'g', ctrlKey: true })
    press(root, { key: 'G', ctrlKey: true, shiftKey: true })
    expect(actions.findAgain.mock.calls).toEqual([[false], [true]])
  })

  it('undoes and redoes without an active tool', () => {
    const { root, actions, press } = setup()
    press(root, { key: 'z', ctrlKey: true })
    press(root, { key: 'Z', ctrlKey: true, shiftKey: true })
    press(root, { key: 'y', ctrlKey: true })
    expect(actions.undo).toHaveBeenCalledTimes(1)
    expect(actions.redo).toHaveBeenCalledTimes(2)
  })

  // The undo and redo buttons do the same.
  it.each([
    ['undo', { hasSomethingToUndo: true, hasSomethingToRedo: false }, false],
    ['undo', { hasSomethingToUndo: false, hasSomethingToRedo: true }, true],
    ['redo', { hasSomethingToUndo: false, hasSomethingToRedo: true }, false],
    ['redo', { hasSomethingToUndo: true, hasSomethingToRedo: false }, true]
  ] as const)(
    'leaves %s with an active tool to PDF.js while it has edits (%o), otherwise undoes page operations: %s',
    (action, editingStates, isHandled) => {
      const { container, actions, press } = setup({ isToolActive: true, editingStates })
      const isRedo = action === 'redo'
      const event = press(container, { key: isRedo ? 'Z' : 'z', shiftKey: isRedo, ctrlKey: true })
      expect(event.defaultPrevented).toBe(isHandled)
      expect(actions[action]).toHaveBeenCalledTimes(isHandled ? 1 : 0)
    }
  )

  it('leaves undo while typing to PDF.js', () => {
    const { input, actions, press } = setup({ isToolActive: true })
    press(input, { key: 'z', ctrlKey: true })
    expect(actions.undo).not.toHaveBeenCalled()
  })

  it('zooms with ctrl + "+", which needs Shift on many keyboards', () => {
    const { root, actions, press } = setup()
    press(root, { key: '+', ctrlKey: true, shiftKey: true })
    expect(actions.zoomIn).toHaveBeenCalled()
  })
})
