import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// This is a dynamic page, so we need to revalidate it to ensure fresh data.
export const revalidate = 0

export default async function TeamPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  // Security check: Verify the user is a member of this team.
  const { data: teamMember, error: memberError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .eq('team_id', params.id)
    .single()

  if (memberError || !teamMember) {
    // If the user is not a member, redirect them to the home page.
    return redirect('/?error=' + encodeURIComponent('You do not have access to this team.'))
  }

  // Fetch team details
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('name')
    .eq('id', params.id)
    .single()

  if (teamError || !team) {
    return redirect('/?error=' + encodeURIComponent('Team not found.'))
  }

  // Placeholder for fetching todos. This will be implemented next.
  const todos = []

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {team.name}
          </h1>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Todo List
        </h2>
        {/* Todo list and add form will go here */}
        <p className="text-center text-gray-500 dark:text-gray-400">
          Todo functionality coming soon!
        </p>
      </main>
    </div>
  )
}