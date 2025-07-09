require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// 使用service role来绕过RLS
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

async function analyzeRLSIssue() {
  try {
    console.log('=== 深度分析RLS策略问题 ===\n');
    
    // 1. 直接查询PostgreSQL系统表来获取策略信息
    console.log('🔍 查询当前RLS策略...');
    
    // 使用原生SQL查询策略
    const { data: policies, error: policiesError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE tablename IN ('teams', 'team_members')
          ORDER BY tablename, policyname;
        `
      });
    
    if (policiesError) {
      console.error('❌ 策略查询失败:', policiesError);
      
      // 尝试另一种方法：直接查询pg_policy表
      console.log('\n🔄 尝试备用查询方法...');
      
      const { data: rawPolicies, error: rawError } = await supabaseAdmin
        .rpc('exec_sql', {
          sql: `
            SELECT 
              pol.polname as policyname,
              tab.relname as tablename,
              pol.polcmd as cmd,
              pol.polpermissive as permissive,
              pol.polroles as roles,
              pol.polqual as qual,
              pol.polwithcheck as with_check
            FROM pg_policy pol
            JOIN pg_class tab ON pol.polrelid = tab.oid
            JOIN pg_namespace nsp ON tab.relnamespace = nsp.oid
            WHERE nsp.nspname = 'public' 
            AND tab.relname IN ('teams', 'team_members')
            ORDER BY tab.relname, pol.polname;
          `
        });
      
      if (rawError) {
        console.error('❌ 备用查询也失败:', rawError);
      } else {
        console.log('✅ 策略信息 (备用方法):');
        console.table(rawPolicies);
      }
    } else {
      console.log('✅ 当前RLS策略:');
      console.table(policies);
    }
    
    // 2. 检查表的RLS状态
    console.log('\n🔒 检查表的RLS启用状态...');
    const { data: rlsStatus, error: rlsError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            rowsecurity as rls_enabled
          FROM pg_tables 
          WHERE tablename IN ('teams', 'team_members')
          AND schemaname = 'public';
        `
      });
    
    if (rlsError) {
      console.error('❌ RLS状态查询失败:', rlsError);
    } else {
      console.log('✅ RLS启用状态:');
      console.table(rlsStatus);
    }
    
    // 3. 检查表结构
    console.log('\n📋 检查表结构...');
    
    // 检查teams表
    const { data: teamsStructure, error: teamsError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'teams' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (teamsError) {
      console.error('❌ Teams表结构查询失败:', teamsError);
    } else {
      console.log('✅ Teams表结构:');
      console.table(teamsStructure);
    }
    
    // 检查team_members表
    const { data: membersStructure, error: membersError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'team_members' 
          AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (membersError) {
      console.error('❌ Team_members表结构查询失败:', membersError);
    } else {
      console.log('\n✅ Team_members表结构:');
      console.table(membersStructure);
    }
    
    // 4. 测试策略是否导致递归
    console.log('\n🧪 测试策略递归问题...');
    
    // 创建一个测试用户ID（UUID格式）
    const testUserId = '00000000-0000-0000-0000-000000000000';
    
    // 测试team_members查询是否会导致递归
    const { data: recursionTest, error: recursionError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          -- 设置一个测试用户ID
          SET LOCAL "request.jwt.claims" = '{"sub": "${testUserId}"}';
          
          -- 尝试查询team_members表
          SELECT COUNT(*) as member_count 
          FROM team_members 
          LIMIT 1;
        `
      });
    
    if (recursionError) {
      console.error('❌ 递归测试失败:', recursionError);
      if (recursionError.message && recursionError.message.includes('infinite recursion')) {
        console.log('🚨 确认存在无限递归问题！');
      }
    } else {
      console.log('✅ 递归测试通过:', recursionTest);
    }
    
    // 5. 分析问题策略
    console.log('\n🔍 分析问题策略...');
    
    const problematicPolicy = `
    当前的 "Users can view team members" 策略可能存在问题：
    
    CREATE POLICY "Users can view team members" ON team_members
        FOR SELECT USING (
            team_id IN (
                SELECT team_id FROM team_members WHERE user_id = auth.uid()
            )
        );
    
    问题分析：
    1. 这个策略在 team_members 表上定义
    2. 但是策略的条件又查询了 team_members 表
    3. 这会导致无限递归：
       - 要查询 team_members，需要检查策略
       - 策略检查需要查询 team_members
       - 形成死循环
    
    解决方案：
    1. 使用 teams 表来验证权限，而不是 team_members 表
    2. 或者使用更简单的策略逻辑
    `;
    
    console.log(problematicPolicy);
    
    console.log('\n=== 分析完成 ===');
    
  } catch (error) {
    console.error('💥 分析过程中发生错误:', error);
  }
}

analyzeRLSIssue();