'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function addPrivateTodo(formData: FormData) {
  const task = formData.get('task')?.toString()

  if (!task || task.trim() === '') {
    return
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const { error } = await supabase.from('todos').insert({
    task: task.trim(),
    user_id: user.id,
    // team_id is intentionally left as NULL
  })

  if (error) {
    console.error('Error adding private todo:', error)
  }

  revalidatePath('/private-todos')
}

export async function togglePrivateTodo(todoId: number, isCompleted: boolean) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('todos')
    .update({ is_completed: !isCompleted })
    .eq('id', todoId)

  if (error) {
    console.error('Error toggling private todo:', error)
  }

  revalidatePath('/private-todos')
}

export async function deletePrivateTodo(todoId: number) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId)

  if (error) {
    console.error('Error deleting private todo:', error)
  }

  revalidatePath('/private-todos')
}
