#!/usr/bin/env node

/**
 * 执行邀请功能RLS策略修复
 * 解决团队创建者无法邀请其他用户的问题
 */

const fs = require('fs');
const path = require('path');

// 读取环境变量
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必要的环境变量:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅' : '❌');
  console.error('\n请确保 .env.local 文件包含正确的Supabase配置');
  process.exit(1);
}

console.log('🔧 开始修复邀请功能RLS策略...');
console.log('\n📋 问题描述:');
console.log('   当前RLS策略只允许用户添加自己为团队成员');
console.log('   但邀请功能需要团队创建者能够添加其他用户');

console.log('\n🛠️ 修复方案:');
console.log('   更新team_members表的INSERT策略');
console.log('   允许团队创建者邀请其他用户加入');

// 读取SQL文件
const sqlFile = path.join(__dirname, 'fix-invite-rls-policy.sql');
if (!fs.existsSync(sqlFile)) {
  console.error('❌ 找不到SQL文件:', sqlFile);
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFile, 'utf8');
console.log('\n📄 SQL内容:');
console.log('---');
console.log(sqlContent);
console.log('---');

console.log('\n⚠️ 手动执行步骤:');
console.log('1. 打开 Supabase Dashboard');
console.log('2. 进入 SQL Editor');
console.log('3. 复制上面的SQL内容并执行');
console.log('4. 确认策略更新成功');

console.log('\n🔍 验证方法:');
console.log('执行完成后，尝试在团队页面邀请用户');
console.log('应该不再出现 "row-level security policy" 错误');

// 尝试自动执行（如果环境变量正确）
try {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('\n🚀 尝试自动执行...');
  
  // 分别执行每个SQL语句
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  
  async function executeStatements() {
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('执行:', statement.substring(0, 50) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          console.error('❌ 执行失败:', error.message);
          return false;
        }
      }
    }
    return true;
  }
  
  executeStatements().then(success => {
    if (success) {
      console.log('\n✅ RLS策略修复完成！');
      console.log('现在可以测试邀请功能了');
    } else {
      console.log('\n❌ 自动执行失败，请手动执行SQL');
    }
  }).catch(err => {
    console.error('\n❌ 执行错误:', err.message);
    console.log('请手动在Supabase Dashboard中执行SQL');
  });
  
} catch (err) {
  console.log('\n⚠️ 无法自动执行，请手动在Supabase Dashboard中执行SQL');
  console.log('错误:', err.message);
}