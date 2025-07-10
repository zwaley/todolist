import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { useTranslations } from 'next-intl'
import { signIn, signUp } from './actions'
import { LanguageToggle } from '@/components/LanguageSwitcher'

interface LoginPageProps {
  searchParams: Promise<{ message?: string }>
  params: Promise<{ locale: string }>
}

export default async function LoginPage({ searchParams, params }: LoginPageProps) {
  const { locale } = await params
  const resolvedSearchParams = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return redirect(`/${locale}`)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 语言切换器 */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <LoginForm searchParams={resolvedSearchParams} locale={locale} />
      </div>
    </div>
  )
}

// 登录表单组件
function LoginForm({ searchParams, locale }: { searchParams: { message?: string }, locale: string }) {
  const t = useTranslations('auth')
  
  return (
    <>
      <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
        {t('loginOrSignUp')}
      </h1>
      <form className="space-y-6">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label
            htmlFor="email"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            {t('email')}
          </label>
          <input
            type="email"
            name="email"
            id="email"
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            {t('password')}
          </label>
          <input
            type="password"
            name="password"
            id="password"
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="••••••••"
            required
          />
        </div>
        <button
          formAction={signIn}
          className="w-full px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          {t('signIn')}
        </button>
        <button
          formAction={signUp}
          className="w-full px-5 py-3 text-base font-medium text-center text-gray-900 bg-gray-200 rounded-lg hover:bg-gray-300 focus:ring-4 focus:ring-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:focus:ring-gray-800"
        >
          {t('signUp')}
        </button>
        {searchParams?.message && (
          <p className="mt-4 p-4 bg-foreground/10 text-foreground text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </>
  )
}