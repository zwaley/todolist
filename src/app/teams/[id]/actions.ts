'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function addTodo(teamId: string, formData: FormData) {
  const task = formData.get('task')?.toString()

  if (!task || task.trim() === '') {
    return // Or handle the error appropriately
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return // Or handle the error appropriately
  }

  const { error } = await supabase.from('todos').insert({
    task: task.trim(),
    team_id: parseInt(teamId),
    user_id: user.id,
  })

  if (error) {
    console.error('Error adding todo:', error)
    // Optionally, handle the error in the UI
  }

  revalidatePath(`/teams/${teamId}`)
}

export async function toggleTodo(teamId: string, todoId: number, isCompleted: boolean) {
  const cookieStore = cookies()
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
  const cookieStore = cookies()
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

export async function inviteMember(teamId: string, formData: FormData) {
  const email = formData.get('email')?.toString()

  if (!email || email.trim() === '') {
    return { error: 'Email cannot be empty.' }
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { error: 'Authentication required.' }
  }

  // 1. Find the user by email
  const { data: invitedUser, error: userError } = await supabase
    .from('users') // Using the public.users view/table if it exists, otherwise auth.users
    .select('id')
    .eq('email', email.trim())
    .single()

  if (userError || !invitedUser) {
    console.error('Error finding user by email:', userError)
    return { error: 'User with this email not found.' }
  }

  // 2. Check if the user is already a member of this team
  const { data: existingMember, error: existingMemberError } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', parseInt(teamId))
    .eq('user_id', invitedUser.id)
    .single()

  if (existingMemberError && existingMemberError.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error('Error checking existing member:', existingMemberError)
    return { error: 'Failed to check existing membership.' }
  }

  if (existingMember) {
    return { error: 'User is already a member of this team.' }
  }

  // 3. Add the new member to the team
  const { error: insertError } = await supabase.from('team_members').insert({
    team_id: parseInt(teamId),
    user_id: invitedUser.id,
  })

  if (insertError) {
    console.error('Error adding new member:', insertError)
    return { error: insertError.message || 'Failed to add member.' }
  }

  revalidatePath(`/teams/${teamId}`)
  return { success: true }
}
