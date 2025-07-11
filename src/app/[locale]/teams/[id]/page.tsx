import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { addTodo, toggleTodo, deleteTodo, inviteMember } from './actions'
import EnhancedInviteForm from './enhanced-invite-form'
import InviteCodeSection from './invite-code-section'
import { TodoStatsBadge } from '@/components/todo-stats-badge'
import { LanguageToggle } from '@/components/LanguageSwitcher'
import TeamMemberActions from '@/components/TeamMemberActions'
import { cookies } from 'next/headers'

// This is a dynamic page, so we need to revalidate it to ensure fresh data.
export const revalidate = 0

interface TeamPageProps {
  params: Promise<{ id: string; locale: string }>
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { id: teamId, locale } = await params
  const cookieStore = await cookies()
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  console.log('所有 cookies:', cookieStore.getAll())
  console.log('user.id:', user?.id)

  if (!user) {
    return redirect(`/${locale}/login`)
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
    return redirect(`/${locale}?error=` + encodeURIComponent('You do not have access to this team.'))
  }

  // Fetch team details
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('name, created_by')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    return redirect(`/${locale}?error=` + encodeURIComponent('Team not found.'))
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
      <TeamHeader 
        teamName={team.name} 
        todoStats={todoStats} 
        locale={locale} 
      />
      
      <main className="flex-1 w-full max-w-4xl p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
          <TodoSection 
            teamId={teamId} 
            todos={todos || []} 
            locale={locale} 
          />
          
          <TeamMembersSection 
            teamId={teamId}
            members={membersWithProfiles}
            isTeamCreator={team.created_by === user.id}
            locale={locale}
            currentUserId={user.id}
            teamCreatorId={team.created_by}
          />
        </div>
      </main>
    </div>
  )
}

// 团队页面头部
function TeamHeader({ teamName, todoStats, locale }: {
  teamName: string
  todoStats: { total: number; completed: number; pending: number }
  locale: string
}) {
  const tNav = useTranslations('navigation')
  
  return (
    <header className="w-full p-4 bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {teamName}
          </h1>
          <TodoStatsBadge 
            total={todoStats.total}
            completed={todoStats.completed}
            pending={todoStats.pending}
            variant="full"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <LanguageToggle />
          <Link href={`/${locale}`}>
            <span className="text-blue-500 hover:underline cursor-pointer">
              ← {tNav('backToTeamList')}
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}

// 待办事项部分
function TodoSection({ teamId, todos, locale }: {
  teamId: string
  todos: Array<{ id: number; task: string; is_completed: boolean }>
  locale: string
}) {
  const t = useTranslations('todos')
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('addNewTodo')}
      </h2>
      
      <form action={addTodo} className="flex gap-2 mb-8">
        <input type="hidden" name="team_id" value={teamId} />
        <input type="hidden" name="locale" value={locale} />
        <input
          type="text"
          name="task"
          className="flex-grow px-3 py-2 text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
          placeholder={t('todoPlaceholder')}
          required
        />
        <button
          type="submit"
          className="px-5 py-3 text-base font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
        >
          {t('add')}
        </button>
      </form>

      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('todoList')}
      </h2>
      
      <div className="space-y-4">
        {todos && todos.length > 0 ? (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center justify-between p-4 rounded-lg shadow-md bg-white dark:bg-gray-800"
            >
              <form action={toggleTodo} className="flex-grow">
                <input type="hidden" name="team_id" value={teamId} />
                <input type="hidden" name="todo_id" value={todo.id} />
                <input type="hidden" name="is_completed" value={todo.is_completed.toString()} />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className={`text-left w-full cursor-pointer ${
                    todo.is_completed 
                      ? 'line-through text-gray-500' 
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {todo.task}
                </button>
              </form>
              <form action={deleteTodo}>
                <input type="hidden" name="team_id" value={teamId} />
                <input type="hidden" name="todo_id" value={todo.id} />
                <input type="hidden" name="locale" value={locale} />
                <button
                  type="submit"
                  className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  {t('delete')}
                </button>
              </form>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400">
            {t('noTodos')}
          </p>
        )}
      </div>
    </div>
  )
}

// 团队成员部分
function TeamMembersSection({ teamId, members, isTeamCreator, locale, currentUserId, teamCreatorId }: {
  teamId: string
  members: Array<{
    user_id: string
    profile: {
      username: string
      display_name: string
      avatar_url: string
      email: string
    }
  }>
  isTeamCreator: boolean
  locale: string
  currentUserId: string
  teamCreatorId: string
}) {
  const t = useTranslations('teams')
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
        {t('teamMembers')}
      </h2>
      
      <div className="space-y-3 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        {members && members.length > 0 ? (
          members.map((member) => (
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
              <div className="flex flex-col flex-grow">
                <span className="font-medium">
                  {member.profile.display_name || member.profile.username || t('unknownUser')}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {member.profile.email || t('noEmailAvailable')}
                </span>
              </div>
              <TeamMemberActions 
                  teamId={teamId}
                  memberId={member.user_id}
                  isCurrentUser={member.user_id === currentUserId}
                  isTeamCreator={member.user_id === teamCreatorId}
                  currentUserIsCreator={isTeamCreator}
                  locale={locale}
                />
            </div>
          ))
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            {t('noMembersFound')}
          </p>
        )}
      </div>

      {/* 邀请码部分 - 仅团队创建者可见 */}
      <div className="mt-8">
        <InviteCodeSection 
          teamId={teamId} 
          isTeamCreator={isTeamCreator} 
          locale={locale} 
        />
      </div>

      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-8 mb-4">
        {t('inviteNewMember')}
      </h3>
      <EnhancedInviteForm teamId={teamId} locale={locale} />
    </div>
  )
}