require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testTeamCreation() {
  try {
    console.log('=== 测试团队创建流程 ===\n');
    
    // 1. 检查当前用户
    console.log('🔍 检查用户认证状态...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ 用户认证错误:', userError);
      return;
    }
    
    if (!user) {
      console.log('❌ 用户未登录，无法测试团队创建');
      return;
    }
    
    console.log('✅ 用户已登录:', user.email);
    
    // 2. 测试查询现有团队
    console.log('\n📋 查询现有团队...');
    const { data: existingTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, created_by')
      .eq('created_by', user.id);
    
    if (teamsError) {
      console.error('❌ 查询团队错误:', teamsError);
    } else {
      console.log('✅ 现有团队数量:', existingTeams.length);
      if (existingTeams.length > 0) {
        console.table(existingTeams);
      }
    }
    
    // 3. 测试查询团队成员
    console.log('\n👥 查询团队成员关系...');
    const { data: memberRelations, error: membersError } = await supabase
      .from('team_members')
      .select('team_id, user_id, joined_at')
      .eq('user_id', user.id);
    
    if (membersError) {
      console.error('❌ 查询团队成员错误:', membersError);
      console.log('错误详情:', JSON.stringify(membersError, null, 2));
    } else {
      console.log('✅ 用户参与的团队数量:', memberRelations.length);
      if (memberRelations.length > 0) {
        console.table(memberRelations);
      }
    }
    
    // 4. 测试创建新团队（使用唯一名称）
    const testTeamName = `测试团队_${Date.now()}`;
    console.log(`\n🚀 尝试创建测试团队: ${testTeamName}`);
    
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({
        name: testTeamName,
        created_by: user.id,
      })
      .select('id, name')
      .single();
    
    if (createError) {
      console.error('❌ 创建团队错误:', createError);
      console.log('错误详情:', JSON.stringify(createError, null, 2));
      return;
    }
    
    console.log('✅ 团队创建成功:', newTeam);
    
    // 5. 测试添加团队成员
    console.log('\n👤 尝试添加团队成员...');
    const { data: newMember, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: newTeam.id,
        user_id: user.id,
      })
      .select('team_id, user_id')
      .single();
    
    if (memberError) {
      console.error('❌ 添加团队成员错误:', memberError);
      console.log('错误详情:', JSON.stringify(memberError, null, 2));
      
      // 清理创建的团队
      console.log('🧹 清理测试团队...');
      await supabase.from('teams').delete().eq('id', newTeam.id);
      return;
    }
    
    console.log('✅ 团队成员添加成功:', newMember);
    
    // 6. 验证数据完整性
    console.log('\n🔍 验证数据完整性...');
    const { data: verifyTeam, error: verifyError } = await supabase
      .from('teams')
      .select(`
        id, 
        name, 
        created_by,
        team_members(
          user_id,
          joined_at
        )
      `)
      .eq('id', newTeam.id)
      .single();
    
    if (verifyError) {
      console.error('❌ 验证数据错误:', verifyError);
    } else {
      console.log('✅ 数据验证成功:');
      console.log(JSON.stringify(verifyTeam, null, 2));
    }
    
    // 7. 清理测试数据
    console.log('\n🧹 清理测试数据...');
    
    // 先删除成员关系
    const { error: deleteMemberError } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', newTeam.id)
      .eq('user_id', user.id);
    
    if (deleteMemberError) {
      console.error('❌ 删除团队成员失败:', deleteMemberError);
    } else {
      console.log('✅ 团队成员删除成功');
    }
    
    // 再删除团队
    const { error: deleteTeamError } = await supabase
      .from('teams')
      .delete()
      .eq('id', newTeam.id);
    
    if (deleteTeamError) {
      console.error('❌ 删除团队失败:', deleteTeamError);
    } else {
      console.log('✅ 测试团队删除成功');
    }
    
    console.log('\n🎉 团队创建流程测试完成！');
    
  } catch (error) {
    console.error('💥 测试过程中发生意外错误:', error);
  }
}

testTeamCreation();