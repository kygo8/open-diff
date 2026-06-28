import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/i18n'
import type { SupportedLocale } from '../core'

interface SkeletonLocaleExpectation {
  locale: SupportedLocale
  label: string
  ready: string
  settings: string
  textCompare: string
}

const skeletonLocales: SkeletonLocaleExpectation[] = [
  {
    locale: 'de-DE',
    label: 'Deutsch',
    ready: 'Bereit',
    settings: 'Einstellungen',
    textCompare: 'Textvergleich',
  },
  {
    locale: 'fr-FR',
    label: 'Français',
    ready: 'Prêt',
    settings: 'Paramètres',
    textCompare: 'Comparaison de texte',
  },
  {
    locale: 'es-ES',
    label: 'Español',
    ready: 'Listo',
    settings: 'Configuración',
    textCompare: 'Comparación de texto',
  },
  {
    locale: 'ko-KR',
    label: '한국어',
    ready: '준비됨',
    settings: '설정',
    textCompare: '텍스트 비교',
  },
]

describe('mainstream language skeleton packs', () => {
  it.each(skeletonLocales)(
    'registers $locale and falls back to English for missing messages',
    ({ locale, label, ready, settings, textCompare }) => {
      const i18n = createAppI18n(locale)

      expect(i18n.locale.value).toBe(locale)
      expect(i18n.availableLocales.value).toContainEqual({ code: locale, label })
      expect(i18n.t('app.ready')).toBe(ready)
      expect(i18n.t('ui.settings')).toBe(settings)
      expect(i18n.t('ui.textCompare')).toBe(textCompare)
      expect(i18n.t('ui.folderSync')).toBe('Folder Sync')
    },
  )
})
