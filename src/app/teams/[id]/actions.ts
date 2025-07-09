'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function addTodo(teamId: string, formData: FormData) {
  const task = formData.get('task')?.toString()

  if (!task || task.trim() === '') {
    return // Or handle the error appropriately
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return // Or handle the error appropriately
  }

  const { error } = await supabase.from('todos').insert({
    task: task.trim(),
    team_id: teamId, // teamId 是 UUID 字符串，不需要转换为整数
    user_id: user.id,
  })

  if (error) {
    console.error('Error adding todo:', error)
    // Optionally, handle the error in the UI
  }

  revalidatePath(`/teams/${teamId}`)
}

export async function joinTeamByInviteCode(inviteCode: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Call the database function to join team by invite code
  const { data, error } = await supabase
    .rpc('join_team_by_invite_code', { invite_code_param: inviteCode })

  if (error) {
    throw new Error('Failed to join team: ' + error.message)
  }

  if (!data || data.length === 0) {
    throw new Error('Invalid response from server')
  }

  const result = data[0]
  if (!result.success) {
    throw new Error(result.message)
  }

  // Revalidate the team page
  revalidatePath(`/teams/${result.team_id}`)
  
  return {
    success: true,
    message: result.message,
    teamId: result.team_id,
    teamName: result.team_name
  }
}

export async function getTeamInviteCode(teamId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Check if user is the team creator
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('invite_code, created_by')
    .eq('id', teamId)
    .single()

  if (teamError) {
    throw new Error('Failed to get team information')
  }

  if (team.created_by !== user.id) {
    throw new Error('Only team creators can view invite codes')
  }

  return team.invite_code
}

export async function regenerateInviteCode(teamId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  // Check if user is the team creator
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('created_by')
    .eq('id', teamId)
    .single()

  if (teamError) {
    throw new Error('Failed to get team information')
  }

  if (team.created_by !== user.id) {
    throw new Error('Only team creators can regenerate invite codes')
  }

  // Generate new invite code
  const { data: newCode, error: generateError } = await supabase
    .rpc('generate_invite_code')

  if (generateError) {
    throw new Error('Failed to generate new invite code')
  }

  // Update team with new invite code
  const { error: updateError } = await supabase
    .from('teams')
    .update({ invite_code: newCode })
    .eq('id', teamId)

  if (updateError) {
    throw new Error('Failed to update invite code')
  }

  revalidatePath(`/teams/${teamId}`)
  return newCode
}

export async function toggleTodo(teamId: string, todoId: number, isCompleted: boolean) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('todos')
    .update({ is_completed: !isCompleted })
    .eq('id', todoId)

  if (error) {
    console.error('Error toggling todo:', error)
    // Optionally, handle the error in the UI
  }

  revalidatePath(`/teams/${teamId}`)
}

export async function deleteTodo(teamId: string, todoId: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId)

  if (error) {
    console.error('Error deleting todo:', error)
    // Optionally, handle the error in the UI
  }

  revalidatePath(`/teams/${teamId}`)
}

export async function inviteMember(teamId: string, identifier: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  let targetUserId: string | null = null

  // 判断输入是邮箱还是用户名
  const isEmail = identifier.includes('@')
  
  if (isEmail) {
    // 通过邮箱查找用户
    const { data, error: userError } = await supabase
      .rpc('get_user_id_by_email', { email: identifier })

    if (userError) {
      throw new Error('Failed to find user by email')
    }
    targetUserId = data
  } else {
    // 通过用户名查找用户
    const { data, error: userError } = await supabase
      .rpc('get_user_id_by_username', { target_username: identifier })

    if (userError) {
      throw new Error('Failed to find user by username')
    }
    targetUserId = data
  }

  if (!targetUserId) {
    if (isEmail) {
      throw new Error('User with this email not found')
    } else {
      throw new Error('User with this username not found')
    }
  }

  // Check if user is already a member
  const { data: existingMember, error: memberError } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('user_id', targetUserId)
    .single()

  if (existingMember) {
    throw new Error('User is already a member of this team')
  }

  // Add user to team
  const { error: insertError } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      user_id: targetUserId
    })

  if (insertError) {
    throw new Error('Failed to add member to team')
  }

  revalidatePath(`/teams/${teamId}`)
}
