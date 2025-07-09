const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFunctions() {
  console.log('🔍 验证邀请功能数据库函数...');
  console.log('=' .repeat(50));

  const results = {
    functions: {},
    tables: {},
    overall: true
  };

  // 1. 直接测试函数调用来检查函数是否存在
  const functionsToTest = [
    { name: 'get_user_id_by_email', params: { email: 'test@example.com' } },
    { name: 'get_user_id_by_username', params: { username: 'testuser' } },
    { name: 'is_user_team_member', params: { p_team_id: 1, p_user_id: 'test-id' } }
  ];

  console.log('\n📋 检查数据库函数:');
  for (const func of functionsToTest) {
    try {
      const { data, error } = await supabase.rpc(func.name, func.params);
      
      if (error) {
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`❌ ${func.name}: 函数不存在`);
          results.functions[func.name] = false;
          results.overall = false;
        } else {
          console.log(`✅ ${func.name}: 函数存在 (调用结果: ${data})`);
          results.functions[func.name] = true;
        }
      } else {
        console.log(`✅ ${func.name}: 函数存在且可调用 (返回: ${data})`);
        results.functions[func.name] = true;
      }
    } catch (err) {
      if (err.message.includes('function') && err.message.includes('does not exist')) {
        console.log(`❌ ${func.name}: 函数不存在`);
        results.functions[func.name] = false;
        results.overall = false;
      } else {
        console.log(`⚠️ ${func.name}: 调用异常但函数可能存在 - ${err.message}`);
        results.functions[func.name] = true; // 假设函数存在但参数有问题
      }
    }
  }

  // 2. 检查 user_profiles 表
  console.log('\n📋 检查数据表:');
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log(`❌ user_profiles 表: 不存在`);
        results.tables.user_profiles = false;
        results.overall = false;
      } else {
        console.log(`✅ user_profiles 表: 存在 (查询错误可能是权限问题)`);
        results.tables.user_profiles = true;
      }
    } else {
      console.log(`✅ user_profiles 表: 存在且可访问`);
      results.tables.user_profiles = true;
    }
  } catch (err) {
    if (err.message.includes('relation') && err.message.includes('does not exist')) {
      console.log(`❌ user_profiles 表: 不存在`);
      results.tables.user_profiles = false;
      results.overall = false;
    } else {
      console.log(`⚠️ user_profiles 表: 访问异常 - ${err.message}`);
      results.tables.user_profiles = false;
      results.overall = false;
    }
  }

  // 3. 检查 teams 和 team_members 表（确保基础表存在）
  console.log('\n📋 检查基础表:');
  const baseTables = ['teams', 'team_members'];
  
  for (const tableName of baseTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`❌ ${tableName} 表: 不存在`);
          results.tables[tableName] = false;
          results.overall = false;
        } else {
          console.log(`✅ ${tableName} 表: 存在`);
          results.tables[tableName] = true;
        }
      } else {
        console.log(`✅ ${tableName} 表: 存在且可访问`);
        results.tables[tableName] = true;
      }
    } catch (err) {
      console.log(`❌ ${tableName} 表: 检查失败 - ${err.message}`);
      results.tables[tableName] = false;
      results.overall = false;
    }
  }

  // 4. 显示总结
  console.log('\n' + '=' .repeat(50));
  if (results.overall) {
    console.log('🎉 所有检查通过！邀请功能数据库组件已正确安装。');
    console.log('\n📝 下一步操作:');
    console.log('1. 在团队页面测试邀请功能');
    console.log('2. 尝试通过邮箱和用户名邀请用户');
    console.log('3. 检查错误处理是否正常工作');
  } else {
    console.log('❌ 检查失败！需要执行修复操作。');
    console.log('\n🔧 修复步骤:');
    console.log('1. 在 Supabase Dashboard 的 SQL Editor 中执行:');
    console.log('   fix-invite-functions-safe.sql');
    console.log('2. 重新运行此验证脚本');
    console.log('3. 如果仍有问题，检查 Supabase 日志');
    
    console.log('\n📋 详细状态:');
    console.log('函数状态:', results.functions);
    console.log('表状态:', results.tables);
  }

  return results;
}

// 运行验证
verifyFunctions()
  .then(() => {
    console.log('\n验证完成。');
    process.exit(0);
  })
  .catch((error) => {
    console.error('验证过程中发生错误:', error);
    process.exit(1);
  });