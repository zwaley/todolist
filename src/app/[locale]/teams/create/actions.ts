'use server'

// 团队创建相关的服务器操作
// 处理团队创建逻辑，包括数据验证、数据库操作和错误处理

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

/**
 * 创建新团队
 * @param formData - 包含团队信息的表单数据
 */
export async function createTeam(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  
  // 获取当前用户
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  // 获取表单数据
  const name = formData.get('name') as string
  const locale = formData.get('locale')?.toString() || 'zh'
  
  if (userError || !user) {
    console.error('用户认证失败:', userError)
    return redirect(`/${locale}/login`)
  }
  
  // 服务器端验证
  if (!name || typeof name !== 'string') {
    return redirect(`/${locale}/teams/create?error=${encodeURIComponent('团队名称不能为空')}`)
  }
  
  const trimmedName = name.trim()
  
  if (trimmedName.length < 2) {
    return redirect(`/${locale}/teams/create?error=${encodeURIComponent('团队名称至少需要2个字符')}`)
  }
  
  if (trimmedName.length > 50) {
    return redirect(`/${locale}/teams/create?error=${encodeURIComponent('团队名称不能超过50个字符')}`)
  }
  
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
    return redirect(`/${locale}/teams/create?error=${encodeURIComponent('团队名称只能包含中文、英文、数字、空格、连字符和下划线')}`)
  }
  
  try {
    // 检查团队名称是否已存在（可选，根据业务需求）
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('name', trimmedName)
      .single()
    
    if (existingTeam) {
      return redirect(`/${locale}/teams/create?error=${encodeURIComponent('团队名称已存在，请选择其他名称')}`)
    }
    
    // 创建团队
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: trimmedName,
        created_by: user.id
      })
      .select()
      .single()
    
    if (teamError) {
      // 记录详细的错误信息到控制台
      console.error('=== 创建团队失败 - 完整错误信息 ===', {
        error: teamError,
        message: teamError.message,
        details: teamError.details,
        hint: teamError.hint,
        code: teamError.code,
        timestamp: new Date().toISOString(),
        userId: user.id,
        teamName: trimmedName
      })
      
      // 构建详细的错误信息给用户
      let errorMessage = '创建团队失败'
      if (teamError.message) {
        errorMessage += `：${teamError.message}`
      }
      if (teamError.code) {
        errorMessage += ` (错误代码: ${teamError.code})`
      }
      if (teamError.details) {
        errorMessage += ` - 详情: ${teamError.details}`
      }
      if (teamError.hint) {
        errorMessage += ` - 建议: ${teamError.hint}`
      }
      
      return redirect(`/${locale}/teams/create?error=${encodeURIComponent(errorMessage)}`)
    }
    
    // 将创建者添加为团队成员
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner'
      })
    
    if (memberError) {
      // 记录详细的错误信息到控制台
      console.error('=== 添加团队成员失败 - 完整错误信息 ===', {
        error: memberError,
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
        code: memberError.code,
        timestamp: new Date().toISOString(),
        userId: user.id,
        teamId: team.id,
        teamName: trimmedName
      })
      
      // 构建详细的错误信息给用户
      let errorMessage = '添加团队成员失败'
      if (memberError.message) {
        errorMessage += `：${memberError.message}`
      }
      if (memberError.code) {
        errorMessage += ` (错误代码: ${memberError.code})`
      }
      if (memberError.details) {
        errorMessage += ` - 详情: ${memberError.details}`
      }
      if (memberError.hint) {
        errorMessage += ` - 建议: ${memberError.hint}`
      }
      
      // 如果添加成员失败，删除已创建的团队
      console.log('正在清理已创建的团队...', team.id)
      await supabase.from('teams').delete().eq('id', team.id)
      
      return redirect(`/${locale}/teams/create?error=${encodeURIComponent(errorMessage)}`)
    }
    
    // 重新验证相关页面的缓存
    revalidatePath(`/${locale}`)
    revalidatePath(`/${locale}/teams/${team.id}`)
    
    // 创建成功，重定向到团队页面
    return redirect(`/${locale}/teams/${team.id}`)
    
  } catch (error) {
    // 记录详细的未知错误信息
    console.error('=== 创建团队时发生未知错误 ===', {
      error: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      userId: user.id,
      teamName: trimmedName
    })
    
    // 构建详细的错误信息给用户
    let errorMessage = '创建团队时发生未知错误'
    if (error instanceof Error) {
      errorMessage += `：${error.message}`
    } else {
      errorMessage += `：${String(error)}`
    }
    
    return redirect(`/${locale}/teams/create?error=${encodeURIComponent(errorMessage)}`)
  }
}