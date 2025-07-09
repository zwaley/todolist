import { useTranslations } from 'next-intl'
import ErrorDisplay from '@/components/ErrorDisplay'
import TeamCreateForm from '@/components/TeamCreateForm'
import { LanguageToggle } from '@/components/LanguageSwitcher'
import Link from 'next/link'

interface CreateTeamPageProps {
  searchParams: Promise<{ error?: string }>
  params: Promise<{ locale: string }>
}

export default async function CreateTeamPage({ searchParams, params }: CreateTeamPageProps) {
  const { locale } = await params
  const searchParamsData = await searchParams
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 语言切换器 */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <CreateTeamHeader />
        
        {searchParamsData.error && (
          <ErrorDisplay 
            error={decodeURIComponent(searchParamsData.error)} 
            className="dark:bg-gray-700 dark:border-gray-600"
          />
        )}
        
        <TeamCreateForm locale={locale} />
        
        <BackToHomeLink locale={locale} />
      </div>
    </div>
  )
}

// 创建团队页面头部
function CreateTeamHeader() {
  const t = useTranslations('teams')
  
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        {t('createNewTeam')}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {t('createTeamDescription')}
      </p>
    </div>
  )
}

// 返回主页链接
function BackToHomeLink({ locale }: { locale: string }) {
  const tNav = useTranslations('navigation')
  
  return (
    <div className="text-center">
      <Link 
        href={`/${locale}`}
        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
      >
        {tNav('backToHome')}
      </Link>
    </div>
  )
}