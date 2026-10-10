import { defineComponent } from 'vue'
import { mock } from 'vitest-mock-extended'
import type { Resource } from '@opencloud-eu/web-client'
import { flushPromises } from '@vue/test-utils'
import { defaultPlugins, mount } from '@opencloud-eu/web-test-helpers'
import App from '../../src/App.vue'

vi.mock('../../src/components/PdfStudio.vue', () => ({
  __esModule: true,
  default: defineComponent({
    name: 'PdfStudio',
    props: {
      resource: { type: Object, required: true },
      currentContent: { type: ArrayBuffer, required: true },
      isReadOnly: { type: Boolean, required: true },
      isDirty: { type: Boolean, required: true }
    },
    emits: ['update:currentContent', 'save', 'register:onSaveCallback'],
    template: '<div class="pdf-studio-stub" />'
  })
}))

describe('PDF Studio app', () => {
  // AppWrapper looks at the wrapped component's props and emits to decide what to load
  // and whether it is an editor (save button, autosave, unsaved changes guard).
  it('declares the props and emits AppWrapper needs for an editor', () => {
    expect(Object.keys(App.props)).toEqual(
      expect.arrayContaining(['resource', 'currentContent', 'isReadOnly', 'isDirty'])
    )
    expect(App.emits).toEqual(
      expect.arrayContaining(['update:currentContent', 'save', 'register:onSaveCallback'])
    )
  })

  it('passes content and state through to the editor and relays its events', async () => {
    const currentContent = new ArrayBuffer(2)
    const resource = mock<Resource>({ id: '1' })
    const wrapper = mount(App, {
      props: {
        resource,
        currentContent,
        isReadOnly: true,
        isDirty: true
      },
      global: { plugins: [...defaultPlugins()] }
    })
    await flushPromises()

    const editor = wrapper.findComponent({ name: 'PdfStudio' })
    expect(editor.props()).toEqual({ resource, currentContent, isReadOnly: true, isDirty: true })

    const newContent = new ArrayBuffer(3)
    editor.vm.$emit('update:currentContent', newContent)
    editor.vm.$emit('save')
    const afterSave = vi.fn()
    editor.vm.$emit('register:onSaveCallback', afterSave)
    expect(wrapper.emitted('update:currentContent')[0]).toEqual([newContent])
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('register:onSaveCallback')[0]).toEqual([afterSave])
  })
})
