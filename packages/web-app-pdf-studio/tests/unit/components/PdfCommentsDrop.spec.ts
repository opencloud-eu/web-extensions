import { ref } from 'vue'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import PdfCommentsDrop from '../../../src/components/PdfCommentsDrop.vue'
import type { CommentData } from '../../../src/helpers/comments'

const screen = { isMobile: ref(false) }
vi.mock('@opencloud-eu/design-system/composables', () => ({ useIsMobile: () => screen }))

function comment(id: string, text: string): CommentData {
  return {
    id,
    pageIndex: 0,
    rect: [0, 0, 1, 1],
    color: [255, 0, 0],
    modificationDate: 'D:20260101',
    contentsObj: { str: text },
    popupRef: 'p'
  }
}

function createWrapper(comments: CommentData[] | undefined, selectedId?: string) {
  const show = vi.fn()
  const hide = vi.fn()
  const wrapper = mount(PdfCommentsDrop, {
    props: { comments, selectedId },
    global: {
      plugins: [...defaultPlugins()],
      stubs: {
        'oc-icon': true,
        OcDrop: {
          name: 'OcDrop',
          template: '<div><slot /></div>',
          emits: ['hideDrop'],
          methods: { show, hide }
        }
      }
    }
  })
  return { wrapper, show, hide }
}

describe('PdfCommentsDrop', () => {
  it('lists the comments with their count', () => {
    const { wrapper } = createWrapper([comment('a', 'First'), comment('b', 'Second')], 'b')
    const items = wrapper.findAll('.pdf-studio-comment-item')
    // Date and time like elsewhere in OpenCloud (the time depends on the time zone).
    expect(items[0].text()).toMatch(/^Jan 1, 2026, \d{1,2}:\d{2}\s?[AP]M First$/)
    expect(items[1].text()).toContain('Second')
    expect(items[0].find('time').attributes('datetime')).toMatch(/^2026-01-01/)
    expect(wrapper.find('.pdf-studio-comments-count').text()).toBe('2')
    expect(items[1].attributes('aria-current')).toBe('true')
  })

  it('explains how to add comments if there are none', () => {
    const { wrapper } = createWrapper([])
    expect(wrapper.findAll('.pdf-studio-comment-item')).toHaveLength(0)
    expect(wrapper.text()).toContain('No comments yet')
  })

  it('opens a comment', async () => {
    const first = comment('a', 'First')
    const { wrapper, hide } = createWrapper([first])
    await wrapper.find('.pdf-studio-comment-item').trigger('click')
    expect(wrapper.emitted('open')).toEqual([[first]])
    expect(hide).not.toHaveBeenCalled()
  })

  // The list is a bottom drawer there, covering the page.
  it('makes room for an opened comment on phones, the comments tool stays active', async () => {
    screen.isMobile.value = true
    const { wrapper, hide } = createWrapper([comment('a', 'First')])
    await wrapper.find('.pdf-studio-comment-item').trigger('click')
    expect(hide).toHaveBeenCalled()
    wrapper.findComponent({ name: 'OcDrop' }).vm.$emit('hideDrop')
    expect(wrapper.emitted('close')).toBeUndefined()
    screen.isMobile.value = false
  })

  it('keeps the list while working with the comments on the page', () => {
    const { wrapper, show } = createWrapper([])
    const popup = document.createElement('div')
    popup.className = 'pdf-studio-comment-popup'
    document.body.append(popup)
    popup.click()
    wrapper.findComponent({ name: 'OcDrop' }).vm.$emit('hideDrop')
    expect(show).toHaveBeenCalledWith({ noFocus: true })
    expect(wrapper.emitted('close')).toBeUndefined()
    popup.remove()
  })

  it('shows line breaks of Acrobat comments', () => {
    const { wrapper } = createWrapper([comment('a', 'One\rTwo')])
    expect(wrapper.find('.pdf-studio-comment-item [dir="auto"]').text()).toBe('One\nTwo')
  })

  it('shows and hides along with the comments tool', async () => {
    const { wrapper, show, hide } = createWrapper(undefined)
    await wrapper.setProps({ comments: [] })
    expect(show).toHaveBeenCalled()
    await wrapper.setProps({ comments: undefined })
    expect(hide).toHaveBeenCalled()
  })

  it.each([
    [[], 1],
    [undefined, 0]
  ])(
    'asks to leave the comments tool when closed by the user (comments: %s)',
    (comments, count) => {
      const { wrapper } = createWrapper(comments)
      wrapper.findComponent({ name: 'OcDrop' }).vm.$emit('hideDrop')
      expect(wrapper.emitted('close') ?? []).toHaveLength(count)
    }
  )
})
