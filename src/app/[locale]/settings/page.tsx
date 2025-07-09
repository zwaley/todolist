import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { updateProfile } from './actions'
import { LanguageToggle } from '@/components/LanguageSwitcher'

interface SettingsPageProps {
  searchParams: Promise<{ success?: string; error?: string }>
  params: Promise<{ locale: string }>
}

// 设置页面 - 用户可以编辑个人资料
export default async function SettingsPage(props: SettingsPageProps) {
  const searchParams = await props.searchParams;
  const { locale } = await props.params
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  // 检查用户是否已登录
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect(`/${locale}/login`)
  }

  // 获取用户的配置文件信息
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('username, display_name, avatar_url, bio')
    .eq('user_id', user.id)
    .single()

  // 如果没有配置文件，创建一个默认的
  let userProfile = profile
  if (profileError || !profile) {
    console.log('用户配置文件不存在，将显示默认值')
    userProfile = {
      username: '',
      display_name: '',
      avatar_url: '',
      bio: ''
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <SettingsHeader locale={locale} />
      
      <main className="flex-1 w-full max-w-2xl p-8">
        <SettingsForm 
          searchParams={searchParams}
          user={user}
          userProfile={userProfile}
          locale={locale}
        />
        <UsageTips />
      </main>
    </div>
  )
}

// 设置页面头部
function SettingsHeader({ locale }: { locale: string }) {
  const t = useTranslations('settings')
  const tNav = useTranslations('navigation')
  
  return (
    <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('personalSettings')}
        </h1>
        <div className="flex items-center space-x-4">
          <LanguageToggle />
          <Link href={`/${locale}`}>
            <span className="text-blue-500 hover:underline cursor-pointer">
              {tNav('backToHome')}
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

// 设置表单组件
function SettingsForm({ 
  searchParams, 
  user, 
  userProfile, 
  locale 
}: { 
  searchParams: { success?: string; error?: string }
  user: any
  userProfile: any
  locale: string
}) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
        {t('editProfile')}
      </h2>
      
      {/* 成功/错误消息显示 */}
      {searchParams.success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {t('messages.profileUpdated')}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {searchParams.error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {t('messages.updateFailed', { error: decodeURIComponent(searchParams.error) })}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 当前用户信息显示 */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
          {t('accountInfo')}
        </h3>
        <p className="text-gray-900 dark:text-white">
          <span className="font-medium">{t('email')}：</span>{user.email}
        </p>
        <p className="text-gray-900 dark:text-white">
          <span className="font-medium">{t('userId')}：</span>{user.id}
        </p>
      </div>

      {/* 个人资料编辑表单 */}
      <form action={updateProfile} className="space-y-6">
        {/* 隐藏字段：用户ID和语言 */}
        <input type="hidden" name="user_id" value={user.id} />
        <input type="hidden" name="locale" value={locale} />
        
        {/* 用户名 */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('username')}
          </label>
          <input
            type="text"
            id="username"
            name="username"
            defaultValue={userProfile.username || ''}
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder={t('usernamePlaceholder')}
            pattern="[a-zA-Z0-9_]+"
            title={t('usernameHint')}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('usernameHint')}
          </p>
        </div>

        {/* 显示名称（昵称） */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('displayName')}
          </label>
          <input
            type="text"
            id="display_name"
            name="display_name"
            defaultValue={userProfile.display_name || ''}
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder={t('displayNamePlaceholder')}
            maxLength={50}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('displayNameHint')}
          </p>
        </div>

        {/* 头像URL */}
        <div>
          <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('avatarUrl')}
          </label>
          <input
            type="url"
            id="avatar_url"
            name="avatar_url"
            defaultValue={userProfile.avatar_url || ''}
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder={t('avatarUrlPlaceholder')}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('avatarUrlHint')}
          </p>
        </div>

        {/* 个人简介 */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('bio')}
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={userProfile.bio || ''}
            className="w-full px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder={t('bioPlaceholder')}
            maxLength={500}
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('bioHint')}
          </p>
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end space-x-4">
          <Link
            href={`/${locale}`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
          >
            {tCommon('cancel')}
          </Link>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
          >
            {t('saveSettings')}
          </button>
        </div>
      </form>
    </div>
  )
}

// 使用提示组件
function UsageTips() {
  const t = useTranslations('settings')
  
  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('accountActions')}
      </h2>
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            {t('usageTips')}
          </h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• {t('tips.username')}</li>
            <li>• {t('tips.displayName')}</li>
            <li>• {t('tips.avatarUrl')}</li>
            <li>• {t('tips.optional')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}