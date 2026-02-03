import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Footer from '../src/components/Footer.vue'

describe('Footer.vue', () => {
  it('should render', () => {
    const wrapper = mount(Footer)
    expect(wrapper.text()).toContain('寻找金币')
  })
})
