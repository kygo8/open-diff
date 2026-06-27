import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobsProgressPanel from './JobsProgressPanel.vue'

describe('JobsProgressPanel', () => {
  it('renders running jobs with progress and cancel controls', async () => {
    const wrapper = mount(JobsProgressPanel, {
      props: {
        jobs: [
          {
            id: 'scan-1',
            title: 'Scan folder',
            status: 'running',
            progress: { current: 5, total: 10, message: 'Scanning' },
            cancellable: true,
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('Scan folder')
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.text()).toContain('Scanning')

    await wrapper.find('[data-testid="cancel-job-scan-1"]').trigger('click')

    expect(wrapper.emitted('cancel')).toEqual([['scan-1']])
  })

  it('renders an empty state when no jobs are running', () => {
    const wrapper = mount(JobsProgressPanel, {
      props: {
        jobs: [],
      },
    })

    expect(wrapper.text()).toContain('No running jobs')
  })
})
