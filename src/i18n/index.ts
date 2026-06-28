import { inject } from 'vue'
import { createI18n, i18nKey, installI18n, type I18nContext, type LanguagePack } from './core'
import { deDE } from './locales/de-DE'
import { enUS } from './locales/en-US'
import { esES } from './locales/es-ES'
import { frFR } from './locales/fr-FR'
import { koKR } from './locales/ko-KR'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'

export function createAppI18n(defaultLocale: string | null | undefined): I18nContext {
  return createI18n({
    defaultLocale,
    fallbackLocale: 'en-US',
    languagePacks: [enUS, zhCN, zhTW, deDE, frFR, esES, koKR],
  })
}

export function useI18n(): I18nContext {
  const i18n = inject(i18nKey)

  if (!i18n) {
    throw new Error('i18n context is not installed')
  }

  return i18n
}

export { installI18n }
export type { I18nContext, LanguagePack }
