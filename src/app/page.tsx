import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Fetch the teams the user is a member of
  const { data: teams, error: teamsError } = await supabase
    .from('team_members')
    .select('teams (*)')
    .eq('user_id', user.id)

  if (teamsError) {
    console.error('Error fetching teams:', teamsError)
    // Optionally, handle the error in the UI
  }

  const logout = async () => {
    'use server'
    const cookieStore = cookies()
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
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              My Private Todos
            </Link>
            <Link
              href="/teams/create"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Create Team
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
            teams.map(({ teams: team }) => team && (
              <Link href={`/teams/${team.id}`} key={team.id}>
                <div className="block p-6 bg-white rounded-lg shadow-md hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer">
                  <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {team.name}
                  </h5>
                  <p className="font-normal text-gray-700 dark:text-gray-400">
                    Click to view todos.
                  </p>
                </div>
              </Link>
            ))
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