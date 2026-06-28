import { describe, expect, it } from 'vitest'
import { createI18n, fallbackLocale, type LanguagePack } from './core'

const englishPack: LanguagePack = {
  locale: 'en-US',
  label: 'English',
  messages: {
    'app.greeting': 'Hello, {name}',
    'app.ready': 'Ready',
  },
}

const chinesePack: LanguagePack = {
  locale: 'zh-CN',
  label: '简体中文',
  messages: {
    'app.ready': '就绪',
  },
}

describe('i18n core', () => {
  it('loads language packs and falls back to English messages', () => {
    const i18n = createI18n({
      defaultLocale: 'zh-CN',
      fallbackLocale,
      languagePacks: [englishPack],
    })

    expect(i18n.locale.value).toBe('en-US')
    expect(i18n.t('app.ready')).toBe('Ready')

    i18n.loadLanguagePack(chinesePack)
    i18n.setLocale('zh-CN')

    expect(i18n.locale.value).toBe('zh-CN')
    expect(i18n.availableLocales.value.map((locale) => locale.code)).toEqual(['en-US', 'zh-CN'])
    expect(i18n.t('app.ready')).toBe('就绪')
    expect(i18n.t('app.greeting', { name: 'Ada' })).toBe('Hello, Ada')
    expect(i18n.t('app.missing')).toBe('app.missing')
  })
})
