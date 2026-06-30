import { config } from '@vue/test-utils'
import { createAppI18n } from '@/i18n'
import { i18nKey } from '@/i18n/core'

const i18n = createAppI18n('en-US')

config.global.provide = {
  ...config.global.provide,
  [i18nKey as symbol]: i18n,
}

config.global.mocks = {
  ...config.global.mocks,
  $t: i18n.t,
}
