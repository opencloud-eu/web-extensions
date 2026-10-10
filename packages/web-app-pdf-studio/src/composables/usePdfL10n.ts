import { onBeforeUnmount } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatDateFromJSDate } from '@opencloud-eu/web-pkg'

type Message = { value?: string; attributes?: Record<string, string> }
type Args = Record<string, string | number>

const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ps', 'ur']

/**
 * PDF.js' texts (toolbars of annotations, placeholders, labels for screen readers) in the
 * translations of the app. PDF.js marks its elements with `data-l10n-id` and
 * `data-l10n-args`, the PDF.js viewer translates them with Fluent and its own locale files,
 * which are not part of the npm package. This provides the same L10n interface with gettext.
 * Texts PDF.js shows for features this app doesn't use are missing and stay English.
 */
export function usePdfL10n() {
  const gettext = useGettext()
  const { $gettext } = gettext

  function title(text: string): Message {
    return { attributes: { title: text } }
  }

  function ariaLabel(text: string): Message {
    return { attributes: { 'aria-label': text } }
  }

  function titleAndLabel(text: string): Message {
    return { attributes: { title: text, 'aria-label': text } }
  }

  const messages: Record<string, (args: Args) => Message> = {
    'pdfjs-page-landmark': ({ page }) =>
      ariaLabel($gettext('Page %{page}', { page: String(page) })),
    'pdfjs-annotation-date-time-string': ({ dateObj }) => ({
      value: formatDateFromJSDate(new Date(dateObj), gettext.current)
    }),
    'pdfjs-text-annotation-type': ({ type }) => ({
      attributes: { alt: $gettext('[%{type} Annotation]', { type: String(type) }) }
    }),
    'pdfjs-highlight-floating-button1': () => titleAndLabel($gettext('Highlight')),
    'pdfjs-highlight-floating-button-label': () => ({ value: $gettext('Highlight') }),
    'pdfjs-comment-floating-button': () => titleAndLabel($gettext('Comment')),
    'pdfjs-comment-floating-button-label': () => ({ value: $gettext('Comment') }),
    'pdfjs-editor-add-comment-button': () => title($gettext('Add comment')),
    'pdfjs-show-comment-button': () => title($gettext('Show comment')),
    'pdfjs-free-text2': () => ({
      attributes: {
        'aria-label': $gettext('Text editor'),
        'default-content': $gettext('Start typing…')
      }
    }),
    'pdfjs-editor-highlight-editor': () => ariaLabel($gettext('Highlight editor')),
    'pdfjs-editor-ink-editor': () => ariaLabel($gettext('Drawing editor')),
    'pdfjs-editor-stamp-editor': () => ariaLabel($gettext('Image editor')),
    'pdfjs-editor-signature-editor1': ({ description }) => ({
      attributes: {
        'aria-description': $gettext('Signature editor: %{description}', {
          description: String(description)
        })
      }
    }),
    'pdfjs-editor-remove-freetext-button': () => title($gettext('Remove text')),
    'pdfjs-editor-remove-highlight-button': () => title($gettext('Remove highlight')),
    'pdfjs-editor-remove-ink-button': () => title($gettext('Remove drawing')),
    'pdfjs-editor-remove-stamp-button': () => title($gettext('Remove image')),
    'pdfjs-editor-remove-signature-button': () => title($gettext('Remove signature')),
    'pdfjs-editor-alt-text-button': () => ariaLabel($gettext('Alt text')),
    'pdfjs-editor-alt-text-button-label': () => ({ value: $gettext('Alt text') }),
    'pdfjs-editor-alt-text-edit-button': () => ariaLabel($gettext('Edit alt text')),
    'pdfjs-editor-alt-text-decorative-tooltip': () => ({ value: $gettext('Marked as decorative') }),
    'pdfjs-editor-colorpicker-button': () => title($gettext('Change color')),
    'pdfjs-editor-colorpicker-dropdown': () => ariaLabel($gettext('Color choices')),
    'pdfjs-editor-colorpicker-yellow': () => title($gettext('Yellow')),
    'pdfjs-editor-colorpicker-green': () => title($gettext('Green')),
    'pdfjs-editor-colorpicker-blue': () => title($gettext('Blue')),
    'pdfjs-editor-colorpicker-pink': () => title($gettext('Pink')),
    'pdfjs-editor-colorpicker-red': () => title($gettext('Red')),
    'pdfjs-editor-color-picker-free-text-input': () => title($gettext('Change text color')),
    'pdfjs-editor-color-picker-ink-input': () => title($gettext('Change drawing color')),
    'pdfjs-editor-resizer-top-left': () => ariaLabel($gettext('Top left corner — resize')),
    'pdfjs-editor-resizer-top-middle': () => ariaLabel($gettext('Top middle — resize')),
    'pdfjs-editor-resizer-top-right': () => ariaLabel($gettext('Top right corner — resize')),
    'pdfjs-editor-resizer-middle-right': () => ariaLabel($gettext('Middle right — resize')),
    'pdfjs-editor-resizer-bottom-right': () => ariaLabel($gettext('Bottom right corner — resize')),
    'pdfjs-editor-resizer-bottom-middle': () => ariaLabel($gettext('Bottom middle — resize')),
    'pdfjs-editor-resizer-bottom-left': () => ariaLabel($gettext('Bottom left corner — resize')),
    'pdfjs-editor-resizer-middle-left': () => ariaLabel($gettext('Middle left — resize')),
    // Announced to screen readers.
    'pdfjs-editor-highlight-added-alert': () => ({ value: $gettext('Highlight added') }),
    'pdfjs-editor-freetext-added-alert': () => ({ value: $gettext('Text added') }),
    'pdfjs-editor-ink-added-alert': () => ({ value: $gettext('Drawing added') }),
    'pdfjs-editor-stamp-added-alert': () => ({ value: $gettext('Image added') }),
    'pdfjs-editor-signature-added-alert': () => ({ value: $gettext('Signature added') })
  }

  function getMessage(id: string, args: Args = {}) {
    return messages[id]?.(args)
  }

  function translateElement(element: Element) {
    const id = element.getAttribute('data-l10n-id')
    const message = id && getMessage(id, JSON.parse(element.getAttribute('data-l10n-args') || '{}'))
    if (!message) {
      return
    }
    // Only on changes, setting the text is a mutation the observer would see again.
    if (message.value !== undefined && element.textContent !== message.value) {
      element.textContent = message.value
    }
    for (const [name, value] of Object.entries(message.attributes ?? {})) {
      if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value)
      }
    }
  }

  function translateTree(root: Element) {
    translateElement(root)
    root.querySelectorAll('[data-l10n-id]').forEach(translateElement)
  }

  const roots = new Set<Element>()
  const observer = new MutationObserver(translateMutations)
  const observerOptions = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-l10n-id', 'data-l10n-args']
  }

  function translateMutations(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        translateElement(mutation.target as Element)
        continue
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          translateTree(node)
        }
      }
    }
  }

  function observe() {
    for (const root of roots) {
      observer.observe(root, observerOptions)
    }
  }

  // Same interface as PDF.js' L10n.
  const l10n = {
    getLanguage: () => gettext.current,
    getDirection: () => (RTL_LANGUAGES.includes(gettext.current.split('_')[0]) ? 'rtl' : 'ltr'),
    get(ids: string | string[], args: Args | null = null) {
      if (Array.isArray(ids)) {
        return Promise.resolve(ids.map((id) => getMessage(id)?.value))
      }
      return Promise.resolve(getMessage(ids, args ?? {})?.value)
    },
    translate(element: Element) {
      roots.add(element)
      translateTree(element)
      observer.observe(element, observerOptions)
      return Promise.resolve()
    },
    translateOnce(element: Element) {
      translateElement(element)
      return Promise.resolve()
    },
    // PDF.js pauses while adding big layers without texts of its own, e.g. the text layer.
    pause() {
      translateMutations(observer.takeRecords())
      observer.disconnect()
    },
    resume: observe,
    destroy() {
      observer.disconnect()
      roots.clear()
      return Promise.resolve()
    }
  }

  onBeforeUnmount(() => l10n.destroy())

  return { l10n }
}
