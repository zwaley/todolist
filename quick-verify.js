require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUser = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * 快速验证RLS修复状态
 */
async function quickVerify() {
  console.log('=== 快速验证RLS修复状态 ===\n');
  
  // 测试teams表
  console.log('🧪 测试teams表查询...');
  const { data: teamsData, error: teamsError } = await supabaseUser
    .from('teams')
    .select('*')
    .limit(1);
  
  if (teamsError) {
    if (teamsError.message.includes('infinite recursion')) {
      console.log('❌ teams表存在无限递归问题!');
      console.log('错误:', teamsError.message);
      return false;
    } else {
      console.log('⚠️  teams表查询失败（非递归问题）:', teamsError.message);
    }
  } else {
    console.log('✅ teams表查询正常');
  }
  
  // 测试team_members表
  console.log('\n🧪 测试team_members表查询...');
  const { data: membersData, error: membersError } = await supabaseUser
    .from('team_members')
    .select('*')
    .limit(1);
  
  if (membersError) {
    if (membersError.message.includes('infinite recursion')) {
      console.log('❌ team_members表存在无限递归问题!');
      console.log('错误:', membersError.message);
      return false;
    } else {
      console.log('⚠️  team_members表查询失败（非递归问题）:', membersError.message);
    }
  } else {
    console.log('✅ team_members表查询正常');
  }
  
  // 最终结论
  console.log('\n📋 === 验证结果 ===');
  
  const hasRecursionIssue = (
    (teamsError && teamsError.message.includes('infinite recursion')) ||
    (membersError && membersError.message.includes('infinite recursion'))
  );
  
  if (hasRecursionIssue) {
    console.log('❌ 修复失败：仍存在无限递归问题');
    console.log('\n需要执行：在Supabase Dashboard中运行 fix-rls-policies.sql');
    return false;
  } else {
    console.log('✅ 修复成功：无限递归问题已解决');
    console.log('\n🎉 可以正常使用团队创建功能了！');
    return true;
  }
}

quickVerify();