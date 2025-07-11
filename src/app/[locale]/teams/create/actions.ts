'use server'


// 团队创建相关的服务器操作
// 调试版本：返回详细错误信息，而不是重定向

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation' // 保留 redirect 用于成功后跳转

// 定义返回类型
interface ActionResult {
  success: boolean;
  error?: string;
  teamId?: string;
}

/**
 * 创建新团队 - 调试版本
 * @param formData - 包含团队信息的表单数据
 * @returns 一个包含操作结果的对象
 */
export async function createTeam(formData: FormData): Promise<void> {
  const supabase = await createClient();

  // 新增：打印服务端数据库信息
  const { data: dbInfo, error: dbInfoError } = await supabase.rpc('whoami');
  console.log('服务端数据库信息:', dbInfo, dbInfoError);
  const locale = formData.get('locale')?.toString() || 'zh'

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('用户认证失败:', userError)
    redirect(`/${locale}/teams/create?error=${encodeURIComponent('用户未登录或认证失败，请重新登录。')}`)
  }

  const name = formData.get('name') as string
  if (!name?.trim()) {
    redirect(`/${locale}/teams/create?error=${encodeURIComponent('团队名称不能为空。')}`)
  }
  const trimmedName = name.trim()

  // 1. 创建团队
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name: trimmedName,
      created_by: user.id,
    })
    .select()
    .single()

  if (teamError) {
    console.error('数据库错误 (创建团队时):', teamError)
    redirect(`/${locale}/teams/create?error=${encodeURIComponent(`创建团队失败: ${teamError.message} (代码: ${teamError.code})`)}`)
  }
  
  if (!team) {
    console.error('创建团队后未返回 team 对象')
    redirect(`/${locale}/teams/create?error=${encodeURIComponent('创建团队失败，未收到有效的返回数据。')}`)
  }

  // 新增：打印新团队 id 和 user.id
  console.log('创建团队成功，team.id:', team.id, 'user.id:', user.id)

  // 只重定向，不再手动插入 team_members
  revalidatePath(`/${locale}/teams`, 'layout')
  redirect(`/${locale}/teams/${team.id}`)
}

// 这个函数现在只用于成功后的跳转
export async function redirectToTeamPage(teamId: string, locale: string) {
    revalidatePath(`/${locale}/teams/\${teamId\}`)
    redirect(`/${locale}/teams/\${teamId\}`)
}
