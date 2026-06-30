import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/i18n'
import { deDE } from './de-DE'
import { enUS } from './en-US'
import { esES } from './es-ES'
import { frFR } from './fr-FR'
import { koKR } from './ko-KR'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'
import type { SupportedLocale } from '../core'

interface SkeletonLocaleExpectation {
  locale: SupportedLocale
  label: string
}

const nonEnglishLocales: SkeletonLocaleExpectation[] = [
  {
    locale: 'zh-CN',
    label: '简体中文',
  },
  {
    locale: 'zh-TW',
    label: '繁體中文',
  },
  {
    locale: 'de-DE',
    label: 'Deutsch',
  },
  {
    locale: 'fr-FR',
    label: 'Français',
  },
  {
    locale: 'es-ES',
    label: 'Español',
  },
  {
    locale: 'ko-KR',
    label: '한국어',
  },
]

describe('localized language packs', () => {
  it.each(nonEnglishLocales)(
    'registers $locale and translates representative messages',
    ({ locale, label }) => {
      const i18n = createAppI18n(locale)

      expect(i18n.locale.value).toBe(locale)
      expect(i18n.availableLocales.value).toContainEqual({ code: locale, label })
      expect(i18n.t('app.ready')).not.toBe(enUS.messages['app.ready'])
      expect(i18n.t('ui.settings')).not.toBe(enUS.messages['ui.settings'])
      expect(i18n.t('ui.textCompare')).not.toBe(enUS.messages['ui.textCompare'])
    },
  )

  it.each([zhCN, zhTW, deDE, esES, frFR, koKR])(
    'covers every English message key for $locale',
    (pack) => {
      const missingKeys = Object.keys(enUS.messages).filter((key) => !pack.messages[key])

      expect(missingKeys).toEqual([])
    },
  )
})
