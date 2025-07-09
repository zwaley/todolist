require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseStructure() {
  try {
    console.log('=== 检查数据库结构 ===\n');
    
    // 检查teams表结构
    console.log('📋 Teams表结构:');
    const { data: teamsData, error: teamsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'teams')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (teamsError) {
      console.error('Teams表查询错误:', teamsError);
    } else {
      console.table(teamsData);
    }
    
    // 检查team_members表结构
    console.log('\n👥 Team_members表结构:');
    const { data: membersData, error: membersError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'team_members')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (membersError) {
      console.error('Team_members表查询错误:', membersError);
    } else {
      console.table(membersData);
    }
    
    // 检查RLS策略
    console.log('\n🔒 RLS策略:');
    const { data: policiesData, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
              FROM pg_policies 
              WHERE tablename IN ('teams', 'team_members') 
              ORDER BY tablename, policyname`
      });
    
    if (policiesError) {
      console.error('RLS策略查询错误:', policiesError);
      console.log('尝试直接查询策略信息...');
      
      // 尝试另一种方式查询策略
      const { data: altPolicies, error: altError } = await supabase
        .from('pg_policies')
        .select('*')
        .in('tablename', ['teams', 'team_members']);
      
      if (altError) {
        console.error('备用策略查询也失败:', altError);
      } else {
        console.table(altPolicies);
      }
    } else {
      console.table(policiesData);
    }
    
    // 检查表约束
    console.log('\n🔗 表约束:');
    const { data: constraintsData, error: constraintsError } = await supabase
      .from('information_schema.table_constraints')
      .select('table_name, constraint_name, constraint_type')
      .in('table_name', ['teams', 'team_members'])
      .eq('table_schema', 'public');
    
    if (constraintsError) {
      console.error('约束查询错误:', constraintsError);
    } else {
      console.table(constraintsData);
    }
    
    // 测试简单查询
    console.log('\n🧪 测试基本查询:');
    
    // 测试teams表查询
    const { data: teamsTest, error: teamsTestError } = await supabase
      .from('teams')
      .select('id, name, created_by')
      .limit(1);
    
    console.log('Teams表查询测试:', teamsTestError ? `错误: ${teamsTestError.message}` : '成功');
    
    // 测试team_members表查询
    const { data: membersTest, error: membersTestError } = await supabase
      .from('team_members')
      .select('team_id, user_id')
      .limit(1);
    
    console.log('Team_members表查询测试:', membersTestError ? `错误: ${membersTestError.message}` : '成功');
    
    console.log('\n=== 检查完成 ===');
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
  }
}

checkDatabaseStructure();