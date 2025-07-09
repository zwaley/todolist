const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

/**
 * 直接测试团队创建功能
 * 模拟actions.ts中的createTeam函数逻辑
 */
async function testTeamCreation() {
  console.log('🧪 开始测试团队创建功能...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) {
    console.error('❌ 缺少必要的环境变量');
    return;
  }
  
  const supabase = createClient(supabaseUrl, anonKey);
  
  try {
    // 1. 测试用户认证状态
    console.log('\n🔐 检查用户认证状态...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ 获取用户信息失败:', userError.message);
      return;
    }
    
    if (!user) {
      console.log('⚠️  用户未登录，无法测试团队创建');
      console.log('请先在浏览器中登录，然后重新运行此脚本');
      return;
    }
    
    console.log('✅ 用户已登录:', user.email);
    
    // 2. 测试teams表访问
    console.log('\n📋 测试teams表访问...');
    const { data: existingTeams, error: teamsError } = await supabase
      .from('teams')
      .select('name')
      .eq('name', 'Test Team ' + Date.now());
    
    if (teamsError) {
      console.error('❌ teams表访问失败:', teamsError.message);
      console.log('错误详情:', teamsError);
      return;
    }
    
    console.log('✅ teams表可访问');
    
    // 3. 尝试创建测试团队
    const testTeamName = 'Test Team ' + Date.now();
    console.log(`\n🏗️  尝试创建团队: ${testTeamName}`);
    
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({
        name: testTeamName,
        description: '这是一个测试团队',
        created_by: user.id
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ 创建团队失败:', createError.message);
      console.log('错误详情:', createError);
      return;
    }
    
    console.log('✅ 团队创建成功:', newTeam);
    
    // 4. 测试team_members表访问和插入
    console.log('\n👥 尝试添加团队成员...');
    const { data: newMember, error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: newTeam.id,
        user_id: user.id,
        role: 'owner'
      })
      .select()
      .single();
    
    if (memberError) {
      console.error('❌ 添加团队成员失败:', memberError.message);
      console.log('错误详情:', memberError);
      
      // 清理：删除已创建的团队
      console.log('🧹 清理已创建的团队...');
      await supabase.from('teams').delete().eq('id', newTeam.id);
      return;
    }
    
    console.log('✅ 团队成员添加成功:', newMember);
    
    // 5. 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await supabase.from('team_members').delete().eq('id', newMember.id);
    await supabase.from('teams').delete().eq('id', newTeam.id);
    console.log('✅ 测试数据清理完成');
    
    console.log('\n🎉 团队创建功能测试通过！');
    
  } catch (error) {
    console.error('❌ 测试过程中出现异常:', error);
  }
}

// 运行测试
testTeamCreation().catch(console.error);