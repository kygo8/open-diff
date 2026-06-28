import {
  computed,
  readonly,
  ref,
  type App,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'

export const fallbackLocale = 'en-US'

export type SupportedLocale = 'en-US' | 'zh-CN' | 'zh-TW' | 'de-DE' | 'fr-FR' | 'es-ES' | 'ko-KR'

export interface LanguagePack {
  locale: SupportedLocale
  label: string
  messages: Record<string, string>
}

export interface LocaleOption {
  code: SupportedLocale
  label: string
}

export interface I18nContext {
  locale: Readonly<Ref<SupportedLocale>>
  availableLocales: ComputedRef<LocaleOption[]>
  loadLanguagePack: (languagePack: LanguagePack) => void
  setLocale: (locale: SupportedLocale) => boolean
  t: (key: string, params?: Record<string, string | number>) => string
}

export interface CreateI18nOptions {
  defaultLocale: string | null | undefined
  fallbackLocale: SupportedLocale
  languagePacks: LanguagePack[]
}

export const i18nKey: InjectionKey<I18nContext> = Symbol('open-diff-i18n')

export function createI18n(options: CreateI18nOptions): I18nContext {
  const packs = new Map<SupportedLocale, LanguagePack>()

  for (const languagePack of options.languagePacks) {
    packs.set(languagePack.locale, languagePack)
  }

  const locale = ref(resolveLocale(options.defaultLocale, packs) ?? options.fallbackLocale)
  const availableLocales = computed(() =>
    [...packs.values()].map((languagePack) => ({
      code: languagePack.locale,
      label: languagePack.label,
    })),
  )

  function loadLanguagePack(languagePack: LanguagePack): void {
    packs.set(languagePack.locale, languagePack)
  }

  function setLocale(nextLocale: SupportedLocale): boolean {
    if (!packs.has(nextLocale)) {
      return false
    }

    locale.value = nextLocale

    return true
  }

  function t(key: string, params: Record<string, string | number> = {}): string {
    const message =
      packs.get(locale.value)?.messages[key] ??
      packs.get(options.fallbackLocale)?.messages[key] ??
      key

    return interpolate(message, params)
  }

  return {
    locale: readonly(locale),
    availableLocales,
    loadLanguagePack,
    setLocale,
    t,
  }
}

export function installI18n(app: App, i18n: I18nContext): void {
  app.provide(i18nKey, i18n)
  app.config.globalProperties.$t = i18n.t
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return ['en-US', 'zh-CN', 'zh-TW', 'de-DE', 'fr-FR', 'es-ES', 'ko-KR'].includes(value)
}

function resolveLocale(
  locale: string | null | undefined,
  packs: Map<SupportedLocale, LanguagePack>,
): SupportedLocale | null {
  if (!locale || !isSupportedLocale(locale) || !packs.has(locale)) {
    return null
  }

  return locale
}

function interpolate(message: string, params: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : placeholder,
  )
}
