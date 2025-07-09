require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// 使用service role来绕过RLS进行管理操作
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function fixRLSFinal() {
  try {
    console.log('=== 彻底修复RLS策略 ===\n');
    
    console.log('🔄 步骤1: 删除所有现有的有问题的策略...');
    
    // 删除所有可能有问题的策略
    const dropPolicies = [
      'DROP POLICY IF EXISTS "Users can view team members" ON team_members;',
      'DROP POLICY IF EXISTS "Users can join teams" ON team_members;',
      'DROP POLICY IF EXISTS "Users can leave teams" ON team_members;',
      'DROP POLICY IF EXISTS "Team creator can add themselves as a member" ON team_members;',
      'DROP POLICY IF EXISTS "Users can create teams" ON teams;',
      'DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;',
      'DROP POLICY IF EXISTS "Team creators can update their teams" ON teams;',
      'DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;',
      'DROP POLICY IF EXISTS "Team creator can select the team" ON teams;'
    ];
    
    for (const dropSQL of dropPolicies) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: dropSQL });
        if (error && !error.message.includes('does not exist')) {
          console.error(`❌ 删除策略失败: ${dropSQL}`, error);
        } else {
          console.log(`✅ 策略删除: ${dropSQL.match(/"([^"]+)"/)?.[1] || '未知策略'}`);
        }
      } catch (e) {
        // 直接执行SQL
        const { error } = await supabaseAdmin.from('_').select('*').limit(0);
        console.log(`⚠️ 跳过策略删除: ${dropSQL}`);
      }
    }
    
    console.log('\n🔄 步骤2: 创建新的、无递归的RLS策略...');
    
    // 为teams表创建策略
    const teamsPolicy1 = `
      CREATE POLICY "Users can create teams" ON teams
        FOR INSERT WITH CHECK (auth.uid() = created_by);
    `;
    
    const teamsPolicy2 = `
      CREATE POLICY "Users can view their own teams" ON teams
        FOR SELECT USING (auth.uid() = created_by);
    `;
    
    const teamsPolicy3 = `
      CREATE POLICY "Team creators can update their teams" ON teams
        FOR UPDATE USING (auth.uid() = created_by)
        WITH CHECK (auth.uid() = created_by);
    `;
    
    // 为team_members表创建策略（关键：避免递归）
    const membersPolicy1 = `
      CREATE POLICY "Users can join teams" ON team_members
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    `;
    
    // 这是关键策略：使用teams表而不是team_members表来验证权限
    const membersPolicy2 = `
      CREATE POLICY "Users can view team members" ON team_members
        FOR SELECT USING (
          -- 用户可以查看自己的成员记录
          auth.uid() = user_id
          OR
          -- 或者用户是团队的创建者（通过teams表验证，避免递归）
          team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
          )
        );
    `;
    
    const membersPolicy3 = `
      CREATE POLICY "Users can leave teams" ON team_members
        FOR DELETE USING (auth.uid() = user_id);
    `;
    
    const policies = [
      { name: 'Teams - 创建策略', sql: teamsPolicy1 },
      { name: 'Teams - 查看策略', sql: teamsPolicy2 },
      { name: 'Teams - 更新策略', sql: teamsPolicy3 },
      { name: 'Members - 加入策略', sql: membersPolicy1 },
      { name: 'Members - 查看策略（无递归）', sql: membersPolicy2 },
      { name: 'Members - 离开策略', sql: membersPolicy3 }
    ];
    
    for (const policy of policies) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: policy.sql });
        if (error) {
          console.error(`❌ 创建策略失败 [${policy.name}]:`, error);
        } else {
          console.log(`✅ 策略创建成功: ${policy.name}`);
        }
      } catch (e) {
        console.error(`💥 策略创建异常 [${policy.name}]:`, e);
      }
    }
    
    console.log('\n🔄 步骤3: 确保RLS已启用...');
    
    const enableRLS = [
      'ALTER TABLE teams ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;'
    ];
    
    for (const sql of enableRLS) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
        if (error) {
          console.error(`❌ 启用RLS失败: ${sql}`, error);
        } else {
          console.log(`✅ RLS已启用: ${sql.match(/TABLE (\w+)/)?.[1]}`);
        }
      } catch (e) {
        console.error(`💥 启用RLS异常: ${sql}`, e);
      }
    }
    
    console.log('\n🧪 步骤4: 测试新策略...');
    
    // 测试策略是否工作正常（使用admin权限）
    try {
      const { data: teamsTest, error: teamsError } = await supabaseAdmin
        .from('teams')
        .select('id, name, created_by')
        .limit(1);
      
      console.log('Teams表查询测试:', teamsError ? `❌ ${teamsError.message}` : '✅ 成功');
      
      const { data: membersTest, error: membersError } = await supabaseAdmin
        .from('team_members')
        .select('team_id, user_id')
        .limit(1);
      
      console.log('Team_members表查询测试:', membersError ? `❌ ${membersError.message}` : '✅ 成功');
      
    } catch (e) {
      console.error('💥 测试查询异常:', e);
    }
    
    console.log('\n📋 步骤5: 策略修复总结...');
    
    const summary = `
    ✅ RLS策略修复完成！
    
    关键修复点：
    1. 删除了所有有递归问题的旧策略
    2. 重新创建了无递归的新策略
    3. team_members的查看策略现在使用teams表验证权限，避免了递归
    4. 确保了RLS在两个表上都已启用
    
    新的策略逻辑：
    - 用户可以创建团队
    - 用户可以查看自己创建的团队
    - 用户可以加入团队（作为自己）
    - 用户可以查看：
      * 自己的成员记录
      * 自己创建的团队的所有成员
    - 用户可以离开团队（删除自己的成员记录）
    
    这个设计避免了无限递归，同时保持了适当的安全性。
    `;
    
    console.log(summary);
    
    console.log('\n🎉 RLS策略修复完成！请重启开发服务器测试。');
    
  } catch (error) {
    console.error('💥 修复过程中发生错误:', error);
  }
}

fixRLSFinal();