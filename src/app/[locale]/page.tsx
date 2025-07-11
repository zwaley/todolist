import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { TodoStatsBadge } from '@/components/todo-stats-badge'
import { LanguageToggle } from '@/components/LanguageSwitcher'

interface HomeProps {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect(`/${locale}/login`)
  }

  // Fetch the teams the user is a member of with todo statistics
  // 
  // RLS策略配置状态 (已确认 2024-12-19):
  // team_members表:
  //   - "Users can view team members" (SELECT): 允许用户查看自己的成员记录或自己创建团队的成员
  //   - "Team owners can manage members" (ALL): 团队创建者可以管理所有成员
  //   - "Users can join teams" (INSERT): 用户可以加入团队
  //   - "Users can leave teams" (DELETE): 用户可以离开团队
  // teams表:
  //   - "Users can view their own teams" (SELECT): 用户只能查看自己创建的团队
  //   - "teams_policy_select" (SELECT): 重复策略，功能相同
  //   - 其他INSERT/UPDATE/DELETE策略正常配置
  // 
  // 此查询通过team_members表关联teams表，依赖上述RLS策略确保用户只能看到自己有权限的团队
  const { data: teams, error: teamsError } = await supabase
    .from('team_members')
    .select(`
      teams (
        id,
        name,
        todos (
          id,
          is_completed
        )
      )
    `)
    .eq('user_id', user.id)

  if (teamsError) {
    console.error('Error fetching teams:', teamsError)
    // Optionally, handle the error in the UI
  }

  // Fetch private todos count for the user
  const { data: privateTodos, error: privateTodosError } = await supabase
    .from('todos')
    .select('id, is_completed')
    .eq('user_id', user.id)
    .is('team_id', null)

  if (privateTodosError) {
    console.error('Error fetching private todos:', privateTodosError)
  }

  // Calculate private todos statistics
  const privateTodosStats = {
    total: privateTodos?.length || 0,
    completed: privateTodos?.filter(todo => todo.is_completed).length || 0,
    pending: privateTodos?.filter(todo => !todo.is_completed).length || 0
  }

  const logout = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    return redirect(`/${locale}/login`)
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-200">
            Welcome, {user.email}
          </span>
          <div className="flex items-center space-x-4">
            <LanguageToggle />
            <HomeNavigation locale={locale} privateTodosStats={privateTodosStats} />
            <form action={logout}>
              <LogoutButton />
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-8">
        <HomeContent teams={teams} locale={locale} />
      </main>
    </div>
  )
}

// 导航组件
function HomeNavigation({ locale, privateTodosStats }: { 
  locale: string
  privateTodosStats: { total: number; completed: number; pending: number }
}) {
  const t = useTranslations('navigation')
  const tCommon = useTranslations('common')
  
  return (
    <>
      <Link
        href={`/${locale}/private-todos`}
        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
      >
        {t('myPrivateTodos')}
        <TodoStatsBadge 
          total={privateTodosStats.total}
          completed={privateTodosStats.completed}
          pending={privateTodosStats.pending}
          variant="minimal"
          className="bg-red-500 text-white font-bold shadow-md"
        />
      </Link>
      <Link
        href={`/${locale}/teams/create`}
        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
      >
        {t('createTeam')}
      </Link>
      <Link
        href={`/${locale}/settings`}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        {tCommon('settings')}
      </Link>
    </>
  )
}

// 退出登录按钮组件
function LogoutButton() {
  const t = useTranslations('common')
  
  return (
    <button
      type="submit"
      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
    >
      {t('logout')}
    </button>
  )
}

// 主要内容组件
function HomeContent({ teams, locale }: { 
  teams: any[] | null
  locale: string 
}) {
  const t = useTranslations('teams')
  const tTodos = useTranslations('todos')
  
  return (
    <>
      <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
        {t('yourTeams')}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams && teams.length > 0 ? (
          teams.map(({ teams: team }) => {
            if (!team) return null
            
            // Calculate team todo statistics
            const teamTodos = team.todos || []
            const teamStats = {
              total: teamTodos.length,
              completed: teamTodos.filter((todo: any) => todo.is_completed).length,
              pending: teamTodos.filter((todo: any) => !todo.is_completed).length
            }
            
            return (
              <Link href={`/${locale}/teams/${team.id}`} key={team.id}>
                <div className="block p-6 bg-white rounded-lg shadow-md hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200">
                  <h5 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {team.name}
                  </h5>
                  
                  {/* 团队待办统计 */}
                  {teamStats.total > 0 ? (
                    <div className="mb-3">
                      <TodoStatsBadge 
                        total={teamStats.total}
                        completed={teamStats.completed}
                        pending={teamStats.pending}
                        variant="full"
                      />
                    </div>
                  ) : (
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-700 dark:text-gray-400">
                        📝 {t('noTodosInTeam')}
                      </span>
                    </div>
                  )}
                  
                  <p className="font-normal text-gray-700 dark:text-gray-400">
                    {t('clickToViewTodos')}
                  </p>
                </div>
              </Link>
            )
          })
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 col-span-full">
            {t('noTeamsYet')}
          </p>
        )}
      </div>
    </>
  )
}