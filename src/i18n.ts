// 国际化配置文件
// 定义支持的语言、默认语言和路由配置

import { notFound } from 'next/navigation'
import { getRequestConfig } from 'next-intl/server'

// 支持的语言列表
export const locales = ['zh', 'en'] as const
export type Locale = (typeof locales)[number]

// 默认语言
export const defaultLocale: Locale = 'zh'

// next-intl 配置
export default getRequestConfig(async ({ locale }) => {
  // 验证传入的语言是否支持
  if (!locales.includes(locale as Locale)) {
    notFound()
  }

  return {
    // 返回locale以满足next-intl 3.22+的要求
    locale,
    // 动态导入对应语言的翻译文件
    messages: (await import(`../messages/${locale}.json`)).default
  }
})

// 语言显示名称映射
export const languageNames = {
  zh: '中文',
  en: 'English'
} as const