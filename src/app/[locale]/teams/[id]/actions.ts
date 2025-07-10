'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function addTodo(formData: FormData) {
  const task = formData.get('task')?.toString()
  const teamId = formData.get('team_id')?.toString()
  const locale = formData.get('locale')?.toString() || 'zh'

  if (!task || task.trim() === '' || !teamId) {
    return // Or handle the error appropriately
  }

  const supabase = await createClient()

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

  revalidatePath(`/${locale}/teams/${teamId}`)
}

export async function joinTeamByInviteCode(inviteCode: string, locale: string = 'zh') {
  const supabase = await createClient()

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
  revalidatePath(`/${locale}/teams/${result.team_id}`)
  
  return {
    success: true,
    message: result.message,
    teamId: result.team_id,
    teamName: result.team_name
  }
}

export async function getTeamInviteCode(teamId: string) {
  const supabase = await createClient()

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

export async function regenerateInviteCode(teamId: string, locale: string = 'zh') {
  const supabase = await createClient()

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

  revalidatePath(`/${locale}/teams/${teamId}`)
  return newCode
}

export async function toggleTodo(formData: FormData) {
  const teamId = formData.get('team_id')?.toString()
  const todoId = parseInt(formData.get('todo_id')?.toString() || '0')
  const isCompleted = formData.get('is_completed') === 'true'
  const locale = formData.get('locale')?.toString() || 'zh'

  if (!teamId || !todoId) {
    return
  }

  const supabase = await createClient()

  // 验证用户是否已登录
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return
  }

  const { error } = await supabase
    .from('todos')
    .update({ is_completed: !isCompleted })
    .eq('id', todoId)
    .eq('team_id', teamId) // 确保只能修改指定团队的todo

  if (error) {
    console.error('Error toggling todo:', error)
    // Optionally, handle the error in the UI
  }

  revalidatePath(`/${locale}/teams/${teamId}`)
}

export async function deleteTodo(formData: FormData) {
  const teamId = formData.get('team_id')?.toString()
  const todoId = parseInt(formData.get('todo_id')?.toString() || '0')
  const locale = formData.get('locale')?.toString() || 'zh'

  if (!teamId || !todoId) {
    return
  }

  const supabase = await createClient()

  // 验证用户是否已登录
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return
  }

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId)
    .eq('team_id', teamId) // 确保只能删除指定团队的todo

  if (error) {
    console.error('Error deleting todo:', error)
    // Optionally, handle the error in the UI
  }

  revalidatePath(`/${locale}/teams/${teamId}`)
}

interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function inviteMember(teamId: string, identifier: string, locale: string = 'zh'): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '您需要登录才能邀请成员' };
    }

    // 验证输入
    if (!identifier || identifier.trim() === '') {
      return { success: false, error: '请输入有效的邮箱地址或用户名' };
    }

    const cleanIdentifier = identifier.trim();
    let targetUserId: string | null = null;
    let searchType = '';

    // 判断输入是邮箱还是用户名/昵称
    const isEmail = cleanIdentifier.includes('@');

    if (isEmail) {
      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanIdentifier)) {
        return { success: false, error: '请输入有效的邮箱地址格式' };
      }

      // 通过邮箱查找用户
      const { data, error: userError } = await supabase
        .rpc('get_user_id_by_email', { email: cleanIdentifier });

      if (userError) {
        console.error('邮箱查找错误:', userError);
        return { success: false, error: '查找用户时发生错误，请稍后重试' };
      }

      targetUserId = data;
      searchType = '邮箱';

      if (!targetUserId) {
        return { success: false, error: '未找到使用该邮箱注册的用户，请确认邮箱地址是否正确' };
      }
    } else {
      // 非邮箱输入，尝试多种方式查找用户
      // 1. 首先尝试通过用户名查找
      const { data: usernameData, error: usernameError } = await supabase
        .rpc('get_user_id_by_username', { username: cleanIdentifier });

      if (usernameError) {
        console.error('用户名查找错误:', usernameError);
      } else if (usernameData) {
        targetUserId = usernameData;
        searchType = '用户名';
      }

      // 2. 如果通过用户名没找到，尝试通过昵称查找
      if (!targetUserId) {
        const { data: displayNameData, error: displayNameError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('display_name', cleanIdentifier)
          .single();

        if (displayNameError && displayNameError.code !== 'PGRST116') {
          console.error('昵称查找错误:', displayNameError);
        } else if (displayNameData) {
          targetUserId = displayNameData.user_id;
          searchType = '昵称';
        }
      }

      if (!targetUserId) {
        return { success: false, error: '未找到该用户名或昵称的用户，请确认输入是否正确' };
      }
    }

    // 检查是否尝试邀请自己
    if (targetUserId === user.id) {
      return { success: false, error: '不能邀请自己加入团队' };
    }

    // Check if user is already a member
    const { data: existingMember, error: memberError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('team_id', teamId)
      .eq('user_id', targetUserId)
      .single();

    if (memberError && memberError.code !== 'PGRST116') {
      console.error('检查成员状态错误:', memberError);
      return { success: false, error: '检查用户状态时发生错误，请稍后重试' };
    }

    if (existingMember) {
      return { success: false, error: '该用户已经是团队成员' };
    }

    // Add user to team
    const { error: insertError } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: targetUserId
      });

    if (insertError) {
      console.error('添加成员错误:', insertError);
      return { success: false, error: `添加团队成员时发生错误: ${insertError.message} (代码: ${insertError.code})` };
    }

    revalidatePath(`/${locale}/teams/${teamId}`);
    return {
      success: true,
      message: `成功邀请${searchType}为 ${cleanIdentifier} 的用户加入团队`
    };

  } catch (error: any) {
    // 如果错误已经是格式化的（例如，来自之前的 throw with '|'），提取消息
    if (error.message && typeof error.message === 'string' && error.message.includes('|')) {
      const parts = error.message.split('|');
      return { success: false, error: parts[1] || '发生未知错误' };
    }

    // 处理未预期的错误
    console.error('邀请成员时发生未预期错误:', error);
    return { success: false, error: `邀请成员时发生未知错误: ${error.message || '未知错误'}` };
  }
}

/**
 * 团队创建者删除成员功能
 * @param teamId 团队ID
 * @param memberUserId 要删除的成员用户ID
 * @param locale 语言设置
 * @returns 操作结果
 */
export async function removeMember(teamId: string, memberUserId: string, locale: string = 'zh'): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    // 验证当前用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '您需要登录才能执行此操作' };
    }

    // 验证输入参数
    if (!teamId || !memberUserId) {
      return { success: false, error: '参数不完整' };
    }

    // 检查当前用户是否为团队创建者
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single();

    if (teamError) {
      console.error('获取团队信息错误:', teamError);
      return { success: false, error: '获取团队信息失败，请稍后重试' };
    }

    if (!team || team.created_by !== user.id) {
      return { success: false, error: '只有团队创建者才能删除成员' };
    }

    // 防止删除自己
    if (memberUserId === user.id) {
      return { success: false, error: '不能删除自己，如需解散团队请联系管理员' };
    }

    // 验证目标用户确实是团队成员
    const { data: memberCheck, error: memberCheckError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('user_id', memberUserId)
      .single();

    if (memberCheckError || !memberCheck) {
      return { success: false, error: '该用户不是团队成员' };
    }

    // 执行删除操作
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', memberUserId);

    if (deleteError) {
      console.error('删除成员错误:', deleteError);
      return { success: false, error: `删除成员失败: ${deleteError.message}` };
    }

    // 刷新页面数据
    revalidatePath(`/${locale}/teams/${teamId}`);
    return {
      success: true,
      message: '成员已成功移除'
    };

  } catch (error: any) {
    console.error('删除成员时发生未预期错误:', error);
    return { success: false, error: `删除成员时发生错误: ${error.message || '未知错误'}` };
  }
}

/**
 * 成员退出团队功能
 * @param teamId 团队ID
 * @param locale 语言设置
 * @returns 操作结果
 */
export async function leaveTeam(teamId: string, locale: string = 'zh'): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    // 验证当前用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '您需要登录才能执行此操作' };
    }

    // 验证输入参数
    if (!teamId) {
      return { success: false, error: '团队ID不能为空' };
    }

    // 检查用户是否为团队创建者
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single();

    if (teamError) {
      console.error('获取团队信息错误:', teamError);
      return { success: false, error: '获取团队信息失败，请稍后重试' };
    }

    // 防止团队创建者退出
    if (team && team.created_by === user.id) {
      return { success: false, error: '团队创建者不能退出团队，如需解散团队请联系管理员' };
    }

    // 验证用户确实是团队成员
    const { data: memberCheck, error: memberCheckError } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (memberCheckError || !memberCheck) {
      return { success: false, error: '您不是该团队的成员' };
    }

    // 执行退出操作
    const { error: deleteError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('退出团队错误:', deleteError);
      return { success: false, error: `退出团队失败: ${deleteError.message}` };
    }

    // 退出成功后重定向到团队列表页面
    revalidatePath(`/${locale}`);
    return {
      success: true,
      message: '已成功退出团队'
    };

  } catch (error: any) {
    console.error('退出团队时发生未预期错误:', error);
    return { success: false, error: `退出团队时发生错误: ${error.message || '未知错误'}` };
  }
}