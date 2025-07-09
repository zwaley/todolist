const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

/**
 * 简单的数据库检查脚本
 * 专门用于诊断团队创建功能的数据库问题
 */
async function checkDatabase() {
  console.log('🔍 开始数据库诊断...');
  
  // 检查环境变量
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ 缺少必要的环境变量');
    console.log('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.log('SERVICE_KEY:', serviceKey ? '✅' : '❌');
    return;
  }
  
  console.log('✅ 环境变量检查通过');
  
  const supabase = createClient(supabaseUrl, serviceKey);
  
  try {
    // 1. 检查teams表
    console.log('\n📋 检查teams表...');
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .limit(1);
    
    if (teamsError) {
      console.error('❌ teams表访问失败:', teamsError.message);
    } else {
      console.log('✅ teams表可访问');
    }
    
    // 2. 检查team_members表结构
    console.log('\n👥 检查team_members表结构...');
    const { data: columnsData, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'team_members' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (columnsError) {
      console.error('❌ 无法获取team_members表结构:', columnsError.message);
    } else {
      console.log('✅ team_members表结构:');
      console.table(columnsData);
      
      // 检查joined_at列
      const hasJoinedAt = columnsData.some(col => col.column_name === 'joined_at');
      console.log(`joined_at列存在: ${hasJoinedAt ? '✅' : '❌'}`);
      
      if (!hasJoinedAt) {
        console.log('\n🔧 需要添加joined_at列...');
        const { error: alterError } = await supabase
          .rpc('exec_sql', {
            sql_query: 'ALTER TABLE team_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();'
          });
        
        if (alterError) {
          console.error('❌ 添加joined_at列失败:', alterError.message);
        } else {
          console.log('✅ joined_at列添加成功');
        }
      }
    }
    
    // 3. 测试team_members表访问
    console.log('\n🧪 测试team_members表访问...');
    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1);
    
    if (membersError) {
      console.error('❌ team_members表访问失败:', membersError.message);
      console.log('错误详情:', membersError);
    } else {
      console.log('✅ team_members表可访问');
    }
    
    // 4. 检查RLS策略
    console.log('\n🔒 检查RLS策略...');
    const { data: policiesData, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT schemaname, tablename, policyname, permissive, cmd, qual
          FROM pg_policies 
          WHERE tablename = 'team_members';
        `
      });
    
    if (policiesError) {
      console.error('❌ 无法获取RLS策略:', policiesError.message);
    } else {
      console.log('✅ team_members表的RLS策略:');
      console.table(policiesData);
    }
    
    console.log('\n🎉 数据库诊断完成');
    
  } catch (error) {
    console.error('❌ 数据库诊断过程中出错:', error);
  }
}

// 运行检查
checkDatabase().catch(console.error);