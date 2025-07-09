require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必要的环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanOrphanedTeamMembers() {
  console.log('🔍 检查孤立的团队成员记录...');
  
  try {
    // 查找所有孤立的团队成员记录（team_id不存在于teams表中）
    const { data: orphanedMembers, error: findError } = await supabase
      .from('team_members')
      .select(`
        id,
        team_id,
        user_id,
        teams!inner(id)
      `);
    
    if (findError) {
      console.error('❌ 查找孤立记录失败:', findError.message);
      return;
    }
    
    // 获取所有team_members记录
    const { data: allMembers, error: allError } = await supabase
      .from('team_members')
      .select('id, team_id, user_id');
    
    if (allError) {
      console.error('❌ 获取所有成员记录失败:', allError.message);
      return;
    }
    
    // 获取所有teams记录
    const { data: allTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id');
    
    if (teamsError) {
      console.error('❌ 获取所有团队记录失败:', teamsError.message);
      return;
    }
    
    console.log(`📊 当前数据统计:`);
    console.log(`   - 团队总数: ${allTeams?.length || 0}`);
    console.log(`   - 团队成员记录总数: ${allMembers?.length || 0}`);
    
    // 找出孤立的成员记录
    const teamIds = new Set(allTeams?.map(t => t.id) || []);
    const orphaned = allMembers?.filter(member => !teamIds.has(member.team_id)) || [];
    
    console.log(`   - 孤立的成员记录数: ${orphaned.length}`);
    
    if (orphaned.length > 0) {
      console.log('\n🗑️ 发现孤立记录，准备清理:');
      orphaned.forEach((member, index) => {
        console.log(`   ${index + 1}. ID: ${member.id}, Team ID: ${member.team_id}, User ID: ${member.user_id}`);
      });
      
      // 删除孤立记录
      const orphanedIds = orphaned.map(m => m.id);
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .in('id', orphanedIds);
      
      if (deleteError) {
        console.error('❌ 删除孤立记录失败:', deleteError.message);
        return;
      }
      
      console.log(`✅ 成功删除 ${orphaned.length} 条孤立记录`);
    } else {
      console.log('✅ 没有发现孤立记录');
    }
    
    // 验证清理结果
    const { data: remainingMembers, error: verifyError } = await supabase
      .from('team_members')
      .select('id');
    
    if (verifyError) {
      console.error('❌ 验证清理结果失败:', verifyError.message);
      return;
    }
    
    console.log(`\n📊 清理后统计:`);
    console.log(`   - 剩余团队成员记录数: ${remainingMembers?.length || 0}`);
    
  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error.message);
  }
}

cleanOrphanedTeamMembers().then(() => {
  console.log('\n🏁 清理完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 脚本执行失败:', error.message);
  process.exit(1);
});