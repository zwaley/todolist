#!/usr/bin/env node

/**
 * 测试邀请功能修复效果
 * 在手动执行RLS策略修复后运行此脚本验证
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量，请检查 .env.local 文件');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInviteFunction() {
  console.log('🧪 测试邀请功能修复效果...');
  
  try {
    // 1. 检查当前RLS策略
    console.log('\n1️⃣ 检查team_members表的RLS策略...');
    const { data: policies, error: policyError } = await supabase
      .from('pg_policies')
      .select('policyname, cmd, qual, with_check')
      .eq('tablename', 'team_members')
      .eq('policyname', 'Users can join teams');
    
    if (policyError) {
      console.error('❌ 无法查询策略:', policyError.message);
      return;
    }
    
    if (policies && policies.length > 0) {
      console.log('✅ 找到邀请策略:');
      policies.forEach(policy => {
        console.log(`   策略名: ${policy.policyname}`);
        console.log(`   操作: ${policy.cmd}`);
        console.log(`   检查条件: ${policy.with_check}`);
      });
    } else {
      console.log('❌ 未找到 "Users can join teams" 策略');
      console.log('   请手动执行 fix-invite-rls-policy.sql');
      return;
    }
    
    // 2. 测试基本数据库连接
    console.log('\n2️⃣ 测试数据库连接...');
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, created_by')
      .limit(3);
    
    if (teamsError) {
      console.error('❌ 无法查询团队:', teamsError.message);
      return;
    }
    
    console.log(`✅ 找到 ${teams.length} 个团队`);
    teams.forEach(team => {
      console.log(`   团队: ${team.name} (ID: ${team.id})`);
    });
    
    // 3. 检查用户配置文件
    console.log('\n3️⃣ 检查用户配置文件...');
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id, username, display_name')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ 无法查询用户配置文件:', profilesError.message);
    } else {
      console.log(`✅ 找到 ${profiles.length} 个用户配置文件`);
      profiles.forEach(profile => {
        console.log(`   用户: ${profile.display_name || profile.username} (ID: ${profile.user_id})`);
      });
    }
    
    // 4. 测试邀请相关函数
    console.log('\n4️⃣ 测试邀请相关函数...');
    
    // 测试邮箱查找函数
    const { data: emailResult, error: emailError } = await supabase
      .rpc('get_user_id_by_email', { email: 'test@example.com' });
    
    if (emailError) {
      console.log('⚠️ 邮箱查找函数测试:', emailError.message);
    } else {
      console.log('✅ 邮箱查找函数正常工作');
    }
    
    // 测试用户名查找函数
    const { data: usernameResult, error: usernameError } = await supabase
      .rpc('get_user_id_by_username', { username: 'testuser' });
    
    if (usernameError) {
      console.log('⚠️ 用户名查找函数测试:', usernameError.message);
    } else {
      console.log('✅ 用户名查找函数正常工作');
    }
    
    console.log('\n🎉 测试完成！');
    console.log('\n📋 下一步:');
    console.log('1. 如果看到策略已更新，请在浏览器中测试邀请功能');
    console.log('2. 如果仍有问题，请手动在Supabase Dashboard执行SQL');
    console.log('3. SQL文件位置: fix-invite-rls-policy.sql');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

testInviteFunction();