#!/usr/bin/env node

/**
 * 简单的邀请功能测试
 * 直接测试邀请逻辑是否工作
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInviteLogic() {
  console.log('🧪 测试邀请功能逻辑...');
  
  try {
    // 1. 获取一个测试团队
    console.log('\n1️⃣ 查找测试团队...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, created_by')
      .limit(1);
    
    if (teamsError || !teams || teams.length === 0) {
      console.error('❌ 无法找到测试团队:', teamsError?.message);
      return;
    }
    
    const testTeam = teams[0];
    console.log(`✅ 找到测试团队: ${testTeam.name} (ID: ${testTeam.id})`);
    console.log(`   创建者: ${testTeam.created_by}`);
    
    // 2. 获取一个测试用户
    console.log('\n2️⃣ 查找测试用户...');
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('user_id, username, display_name')
      .neq('user_id', testTeam.created_by)
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.log('⚠️ 没有找到其他用户进行测试');
      console.log('   这是正常的，如果只有一个用户的话');
      return;
    }
    
    const testUser = users[0];
    console.log(`✅ 找到测试用户: ${testUser.display_name || testUser.username}`);
    console.log(`   用户ID: ${testUser.user_id}`);
    
    // 3. 检查用户是否已经是团队成员
    console.log('\n3️⃣ 检查成员状态...');
    const { data: existingMember, error: memberError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('team_id', testTeam.id)
      .eq('user_id', testUser.user_id)
      .single();
    
    if (memberError && memberError.code !== 'PGRST116') {
      console.error('❌ 检查成员状态失败:', memberError.message);
      return;
    }
    
    if (existingMember) {
      console.log('⚠️ 用户已经是团队成员，跳过邀请测试');
      return;
    }
    
    console.log('✅ 用户不是团队成员，可以进行邀请测试');
    
    // 4. 模拟邀请操作（使用团队创建者身份）
    console.log('\n4️⃣ 模拟邀请操作...');
    
    // 创建一个模拟的团队创建者客户端
    const creatorSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    // 注意：这里我们无法完全模拟用户认证，但可以测试数据库插入
    console.log('⚠️ 注意：无法完全模拟用户认证，建议手动测试');
    
    // 5. 测试数据库函数
    console.log('\n5️⃣ 测试邀请相关函数...');
    
    if (testUser.username) {
      const { data: usernameResult, error: usernameError } = await supabase
        .rpc('get_user_id_by_username', { username: testUser.username });
      
      if (usernameError) {
        console.log('❌ 用户名查找函数失败:', usernameError.message);
      } else {
        console.log('✅ 用户名查找函数正常:', usernameResult === testUser.user_id);
      }
    }
    
    // 6. 检查当前团队成员
    console.log('\n6️⃣ 当前团队成员列表...');
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select(`
        user_id,
        user_profiles!inner(
          username,
          display_name
        )
      `)
      .eq('team_id', testTeam.id);
    
    if (membersError) {
      console.error('❌ 获取团队成员失败:', membersError.message);
    } else {
      console.log(`✅ 团队有 ${members.length} 个成员:`);
      members.forEach(member => {
        const profile = member.user_profiles;
        console.log(`   - ${profile.display_name || profile.username} (${member.user_id})`);
      });
    }
    
    console.log('\n🎉 测试完成！');
    console.log('\n📋 建议:');
    console.log('1. 手动在Supabase Dashboard执行 fix-invite-rls-policy.sql');
    console.log('2. 然后在浏览器中测试邀请功能');
    console.log('3. 查看 INVITE_RLS_FIX_GUIDE.md 获取详细指导');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

testInviteLogic();