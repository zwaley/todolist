'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { handleError, logDetailedError } from '@/lib/error-handler'

export async function createTeam(formData: FormData) {
  const name = formData.get('name')?.toString()

  if (!name || name.trim() === '') {
    const errorResult = handleError('表单验证', { message: '团队名称为空' }, { formData: Object.fromEntries(formData) })
    return redirect('/teams/create?error=' + encodeURIComponent(errorResult.fullMessage))
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // 获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError) {
    const errorResult = handleError('用户认证', userError, { userId: user?.id })
    return redirect('/login?error=' + encodeURIComponent(errorResult.fullMessage))
  }

  if (!user) {
    const errorResult = handleError('用户验证', { message: '用户未登录' })
    return redirect('/login?error=' + encodeURIComponent(errorResult.fullMessage))
  }

  let teamId: number | null = null
  
  // 记录操作开始
  logDetailedError('团队创建开始', { message: '开始创建团队' }, { 
    teamName: name.trim(), 
    userId: user.id, 
    userEmail: user.email 
  })

  try {
    // 1. 创建团队
    console.log('🔄 正在创建团队...', { name: name.trim(), created_by: user.id })
    
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: name.trim(),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (teamError) {
      const errorResult = handleError('团队创建', teamError, { 
        teamName: name.trim(), 
        userId: user.id,
        insertData: { name: name.trim(), created_by: user.id }
      })
      
      // 对于唯一约束冲突，提供更具体的错误消息
      if (teamError?.code === '23505') {
        const specificMessage = `团队名称"${name.trim()}"已存在，请选择不同的团队名称 | 请使用唯一的团队名称`
        return redirect('/teams/create?error=' + encodeURIComponent(specificMessage))
      }
      
      return redirect('/teams/create?error=' + encodeURIComponent(errorResult.fullMessage))
    }

    // 检查是否成功获取到团队数据
    if (!team) {
      const errorResult = handleError('团队数据获取', { 
        message: '团队创建成功但无法获取团队详情，可能是RLS策略问题',
        code: 'RLS_POLICY_ERROR'
      }, { 
        expectedTeamData: true, 
        actualTeamData: team,
        rlsNote: '检查teams表的RLS策略是否正确配置'
      })
      return redirect('/teams/create?error=' + encodeURIComponent(`${errorResult.userMessage} | 请检查数据库RLS策略配置或联系技术支持`))
    }

    teamId = team.id
    console.log('✅ 团队创建成功', { teamId, teamName: name.trim() })

    // 2. 添加创建者为团队成员（使用 UPSERT 避免重复插入）
    console.log('🔄 正在添加团队成员...', { team_id: team.id, user_id: user.id })
    
    // 先检查用户是否已经是团队成员
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('team_id, user_id')
      .eq('team_id', team.id)
      .eq('user_id', user.id)
      .single()
    
    let memberError = null
    
    if (!existingMember) {
      // 用户不是团队成员，添加成员关系
      const { error } = await supabase.from('team_members').insert({
        team_id: team.id,
        user_id: user.id,
      })
      memberError = error
    } else {
      console.log('ℹ️ 用户已经是团队成员，跳过添加步骤', { teamId: team.id, userId: user.id })
    }

    if (memberError) {
      const errorResult = handleError('团队成员添加', memberError, { 
        teamId: team.id, 
        userId: user.id,
        insertData: { team_id: team.id, user_id: user.id },
        cleanupAction: '将尝试删除已创建的团队以防止孤儿数据'
      })
      
      // 对于唯一约束冲突，提供更具体的错误消息
      if (memberError?.code === '23505') {
        const specificMessage = `用户已经是该团队的成员，无需重复添加 | 团队创建成功，但成员关系已存在`
        console.log('ℹ️ 检测到重复成员关系，但团队创建成功', { teamId: team.id, userId: user.id })
        // 不删除团队，因为这不是真正的错误
        return redirect('/teams/create?error=' + encodeURIComponent(specificMessage))
      }
      
      // 如果是其他类型的错误，尝试删除已创建的团队以防止孤儿数据
      console.log('🧹 清理孤儿团队数据...', { teamId: team.id })
      const { error: deleteError } = await supabase.from('teams').delete().eq('id', team.id)
      
      if (deleteError) {
        handleError('团队清理', deleteError, { 
          originalError: memberError,
          teamId: team.id,
          note: '添加成员失败后清理团队也失败，可能产生孤儿数据'
        })
      }
      
      return redirect('/teams/create?error=' + encodeURIComponent(errorResult.fullMessage))
    }
    
    console.log('✅ 团队成员添加成功', { teamId: team.id, userId: user.id })

    // 所有数据库操作成功完成
    console.log('🎉 团队创建流程完全成功！', { 
      teamId: team.id, 
      teamName: name.trim(), 
      userId: user.id 
    })

  } catch (e: any) {
    // 捕获意外错误
    const errorResult = handleError('意外错误', e, {
      teamId,
      teamName: name.trim(),
      userId: user.id,
      operationStage: teamId ? '团队已创建，添加成员时出错' : '团队创建阶段出错',
      cleanupRequired: !!teamId
    })
    
    // 如果在团队创建后但成员添加前发生意外错误，尝试清理已创建的团队
    if (teamId) {
      console.log('🧹 意外错误后清理孤儿团队数据...', { teamId })
      const { error: cleanupError } = await supabase.from('teams').delete().eq('id', teamId)
      
      if (cleanupError) {
        handleError('意外错误后团队清理', cleanupError, {
          originalError: e,
          teamId,
          note: '意外错误后清理团队失败，可能产生孤儿数据'
        })
      } else {
        console.log('✅ 孤儿团队数据清理成功', { teamId })
      }
    }
    
    return redirect('/teams/create?error=' + encodeURIComponent(errorResult.fullMessage))
  }

  // 只有在try块成功完成时才会执行这些行
  console.log('🔄 重新验证页面缓存...')
  revalidatePath('/') // 重新验证主页以显示新团队
  
  console.log('🚀 重定向到主页...')
  redirect('/') // 成功时重定向到主页
}
