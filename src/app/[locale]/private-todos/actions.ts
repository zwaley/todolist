'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function addPrivateTodo(formData: FormData) {
  const task = formData.get('task')?.toString();
  const locale = formData.get('locale')?.toString() || 'zh';

  if (!task || task.trim() === '') {
    return;
  }

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase.from('todos').insert({ 
    task: task.trim(), 
    user_id: user.id,
    is_completed: false
  });

  if (error) {
    console.error('Error adding private todo:', error);
    return;
  }

  revalidatePath(`/${locale}/private-todos`);
}

export async function togglePrivateTodo(formData: FormData) {
  const todoId = parseInt(formData.get('todo_id')?.toString() || '0');
  const isCompleted = formData.get('is_completed') === 'true';
  const locale = formData.get('locale')?.toString() || 'zh';

  if (!todoId) {
    return;
  }

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase
    .from('todos')
    .update({ is_completed: !isCompleted })
    .eq('id', todoId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error toggling private todo:', error);
    return;
  }

  revalidatePath(`/${locale}/private-todos`);
}

export async function deletePrivateTodo(formData: FormData) {
  const todoId = parseInt(formData.get('todo_id')?.toString() || '0');
  const locale = formData.get('locale')?.toString() || 'zh';

  if (!todoId) {
    return;
  }

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting private todo:', error);
    return;
  }

  revalidatePath(`/${locale}/private-todos`);
}