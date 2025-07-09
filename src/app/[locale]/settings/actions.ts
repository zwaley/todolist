'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// 更新用户配置文件的服务器操作
export async function updateProfile(formData: FormData) {
  const locale = formData.get('locale')?.toString() || 'zh'
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  // 验证用户是否已登录
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect(`/${locale}/login`)
  }

  // 从表单数据中提取字段
  const userId = formData.get('user_id') as string
  const username = formData.get('username') as string
  const displayName = formData.get('display_name') as string
  const avatarUrl = formData.get('avatar_url') as string
  const bio = formData.get('bio') as string

  // 验证用户ID匹配
  if (userId !== user.id) {
    throw new Error('用户ID不匹配')
  }

  // 验证用户名格式（如果提供了用户名）
  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error('用户名格式不正确，只能包含字母、数字和下划线')
  }

  // 如果提供了用户名，检查是否已被其他用户使用
  if (username) {
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('username', username)
      .neq('user_id', user.id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('检查用户名时出错:', checkError)
      throw new Error('检查用户名时出错')
    }

    if (existingUser) {
      throw new Error('用户名已被其他用户使用，请选择其他用户名')
    }
  }

  // 准备更新数据
  const updateData: any = {
    username: username || null,
    display_name: displayName || null,
    avatar_url: avatarUrl || null,
    bio: bio || null,
    updated_at: new Date().toISOString()
  }

  try {
    // 首先检查用户配置文件是否存在
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('获取用户配置文件时出错:', fetchError)
      throw new Error('获取用户配置文件时出错')
    }

    if (existingProfile) {
      // 更新现有配置文件
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('更新用户配置文件时出错:', updateError)
        throw new Error('更新用户配置文件时出错: ' + updateError.message)
      }
    } else {
      // 创建新的配置文件
      const createData = {
        user_id: user.id,
        ...updateData,
        created_at: new Date().toISOString()
      }

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([createData])

      if (insertError) {
        console.error('创建用户配置文件时出错:', insertError)
        throw new Error('创建用户配置文件时出错: ' + insertError.message)
      }
    }

    // 重新验证相关页面的缓存
    revalidatePath(`/${locale}/settings`)
    revalidatePath(`/${locale}/teams`)
    revalidatePath(`/${locale}`)

    // 重定向回设置页面，显示成功消息
    redirect(`/${locale}/settings?success=true`)

  } catch (error) {
    console.error('更新配置文件时发生错误:', error)
    
    let errorMessage = '更新配置文件时发生未知错误'
    
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    // 重定向回设置页面，显示错误消息
    redirect(`/${locale}/settings?error=` + encodeURIComponent(errorMessage))
  }
}