import ErrorDisplay from '@/components/ErrorDisplay'
import TeamCreateForm from '@/components/TeamCreateForm'

export default async function CreateTeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            创建新团队
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            创建一个新的团队来协作管理待办事项
          </p>
        </div>
        
        {params.error && (
          <ErrorDisplay 
            error={decodeURIComponent(params.error)} 
            className="dark:bg-gray-700 dark:border-gray-600"
          />
        )}
        
        <TeamCreateForm />
        
        {/* 返回链接 */}
        <div className="text-center">
          <a 
            href="/" 
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            ← 返回主页
          </a>
        </div>
      </div>
    </div>
  )
}
