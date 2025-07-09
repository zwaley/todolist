import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { addTodo, toggleTodo, deleteTodo, inviteMember } from './actions'
import EnhancedInviteForm from './enhanced-invite-form'
import InviteCodeSection from './invite-code-section'
import { TodoStatsBadge } from '@/components/todo-stats-badge'

// This is a dynamic page, so we need to revalidate it to ensure fresh data.
export const revalidate = 0

export default async function TeamPage({ params }: { params: { id: string } }) {
  const teamId = await params.id; // params.id is now awaited as per Next.js 14+ requirements
  const cookieStore = await cookies()
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
    .eq('team_id', teamId)
    .single()

  if (memberError || !teamMember) {
    // If the user is not a member, redirect them to the home page.
    return redirect('/?error=' + encodeURIComponent('You do not have access to this team.'))
  }

  // Fetch team details
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('name, created_by')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return redirect('/?error=' + encodeURIComponent('Team not found.'))
  }

  // Fetch todos for the team
  const { data: todos, error: todosError } = await supabase
    .from('todos')
    .select('id, task, is_completed')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (todosError) {
    console.error('Error fetching todos:', todosError)
  }

  // Calculate todo statistics
  const todoStats = {
    total: todos?.length || 0,
    completed: todos?.filter(todo => todo.is_completed).length || 0,
    pending: todos?.filter(todo => !todo.is_completed).length || 0
  }

  // Fetch team members
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)

  if (membersError) {
    console.error('Error fetching team members:', membersError)
  }

  // Get user profiles and auth user info for all team members
  const memberUserIds = members?.map(member => member.user_id) || []
  
  let userProfiles = []
  let authUsers = []
  
  if (memberUserIds.length > 0) {
    // Get user profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', memberUserIds)
    userProfiles = profiles || []
    
    // Get auth user info (email)
    const { data: users } = await supabase.auth.admin.listUsers()
    authUsers = users?.users?.filter(user => memberUserIds.includes(user.id)) || []
  }

  // Combine member data with profile information
  const membersWithProfiles = members?.map(member => {
    const profile = userProfiles?.find(p => p.user_id === member.user_id)
    const authUser = authUsers?.find(u => u.id === member.user_id)
    return {
      ...member,
      profile: {
        username: profile?.username || '',
        display_name: profile?.display_name || '',
        avatar_url: profile?.avatar_url || '',
        email: authUser?.email || ''
      }
    }
  }) || []

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {team.name}
            </h1>
            {/* 团队待办统计 */}
            <TodoStatsBadge 
              total={todoStats.total}
              completed={todoStats.completed}
              pending={todoStats.pending}
              variant="full"
            />
          </div>
          <Link href="/">
            <span className="text-blue-500 hover:underline cursor-pointer">
              &larr; 返回团队列表
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Add a New Todo
            </h2>
            <form action={addTodo.bind(null, teamId)} className="flex gap-2 mb-8">
              <input
                type="text"
                name="task"
                className="flex-grow px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                placeholder="What needs to be done?"
                required
              />
              <button
                type="submit"
                className="px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
              >
                Add
              </button>
            </form>

            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Todo List
            </h2>
            <div className="space-y-4">
              {todos && todos.length > 0 ? (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center justify-between p-4 rounded-lg shadow-md bg-white dark:bg-gray-800"
                  >
                    <div
                      className={`cursor-pointer ${todo.is_completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}
                      onClick={async () => {
                        'use server'
                        await toggleTodo(teamId, todo.id, todo.is_completed)
                      }}
                    >
                      {todo.task}
                    </div>
                    <form action={deleteTodo.bind(null, teamId, todo.id)}>
                      <button
                        type="submit"
                        className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400">
                  No todos yet. Add one above!
                </p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Team Members
            </h2>
            <div className="space-y-3 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              {membersWithProfiles && membersWithProfiles.length > 0 ? (
                membersWithProfiles.map((member) => (
                  <div key={member.user_id} className="text-gray-900 dark:text-white flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mr-3 text-white font-semibold">
                      {member.profile.avatar_url ? (
                        <img 
                          src={member.profile.avatar_url} 
                          alt="Avatar" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        (member.profile.display_name || member.profile.username || member.profile.email)?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {member.profile.display_name || member.profile.username || 'Unknown User'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {member.profile.email || 'No email available'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  No members found.
                </p>
              )}
            </div>

            {/* 邀请码部分 - 仅团队创建者可见 */}
            <div className="mt-8">
              <InviteCodeSection teamId={teamId} isTeamCreator={team.created_by === user.id} />
            </div>

            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4">
              Invite New Member
            </h3>
            <EnhancedInviteForm teamId={teamId} />
          </div>
        </div>
      </main>
    </div>
  )
}
