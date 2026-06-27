import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FileOperationConfirmDialog from './FileOperationConfirmDialog.vue'

const confirmation = {
  operation: 'delete' as const,
  title: 'Delete 1 item?',
  risk: 'high' as const,
  confirmLabel: 'Delete',
  paths: ['C:/work/old.txt'],
  message: 'This operation can remove files or folders from disk.',
}

describe('FileOperationConfirmDialog', () => {
  it('renders file operation risk and affected paths', () => {
    const wrapper = mount(FileOperationConfirmDialog, {
      props: { confirmation },
    })

    expect(wrapper.text()).toContain('Delete 1 item?')
    expect(wrapper.text()).toContain('high')
    expect(wrapper.text()).toContain('C:/work/old.txt')
    expect(wrapper.text()).toContain('This operation can remove files or folders from disk.')
  })

  it('emits confirm and cancel actions', async () => {
    const wrapper = mount(FileOperationConfirmDialog, {
      props: { confirmation },
    })

    await wrapper.find('[data-testid="confirm-file-operation"]').trigger('click')
    await wrapper.find('[data-testid="cancel-file-operation"]').trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
