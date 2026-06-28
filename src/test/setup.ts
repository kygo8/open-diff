import { config } from '@vue/test-utils'
import { enUS } from '@/i18n/locales/en-US'

config.global.mocks = {
  ...config.global.mocks,
  $t: (key: string, params: Record<string, string | number> = {}) => {
    const message = enUS.messages[key] ?? key

    return message.replace(/\{(\w+)\}/g, (placeholder, paramKey: string) =>
      Object.prototype.hasOwnProperty.call(params, paramKey)
        ? String(params[paramKey])
        : placeholder,
    )
  },
}
