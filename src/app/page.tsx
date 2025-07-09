import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TodoStatsBadge } from '@/components/todo-stats-badge'

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Fetch the teams the user is a member of with todo statistics
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
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    await supabase.auth.signOut()
    return redirect('/login')
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <span className="text-gray-700 dark:text-gray-200">
            Welcome, {user.email}
          </span>
          <div className="flex items-center space-x-4">
            <Link
              href="/private-todos"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              My Private Todos
              <TodoStatsBadge 
                total={privateTodosStats.total}
                completed={privateTodosStats.completed}
                pending={privateTodosStats.pending}
                variant="minimal"
                className="bg-red-500 text-white font-bold shadow-md"
              />
            </Link>
            <Link
              href="/teams/create"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Create Team
            </Link>
            <Link
              href="/settings"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Settings
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Your Teams
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams && teams.length > 0 ? (
            teams.map(({ teams: team }) => {
              if (!team) return null
              
              // Calculate team todo statistics
              const teamTodos = team.todos || []
              const teamStats = {
                total: teamTodos.length,
                completed: teamTodos.filter(todo => todo.is_completed).length,
                pending: teamTodos.filter(todo => !todo.is_completed).length
              }
              
              return (
                <Link href={`/teams/${team.id}`} key={team.id}>
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
                          📝 暂无待办事项
                        </span>
                      </div>
                    )}
                    
                    <p className="font-normal text-gray-700 dark:text-gray-400">
                      点击查看团队待办事项
                    </p>
                  </div>
                </Link>
              )
            })
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 col-span-full">
              You are not a member of any teams yet. Try creating one!
            </p>
          )}
        </div>
      </main>
    </div>
  )
}