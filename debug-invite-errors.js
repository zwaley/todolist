#!/usr/bin/env node

/**
 * 邀请功能错误诊断工具
 * 详细检查邀请功能的每个环节，提供具体的错误信息
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

class InviteErrorDiagnostic {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.errors = [];
    this.warnings = [];
    this.testResults = [];
  }

  log(type, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, type, message, details };
    
    if (type === 'ERROR') {
      this.errors.push(logEntry);
      console.log(`❌ [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else if (type === 'WARNING') {
      this.warnings.push(logEntry);
      console.log(`⚠️  [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else if (type === 'SUCCESS') {
      console.log(`✅ [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else {
      console.log(`ℹ️  [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    }
  }

  // 检查环境配置
  async checkEnvironment() {
    console.log('\n🔍 检查环境配置...');
    
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.log('SUCCESS', `环境变量 ${envVar} 已配置`);
      } else {
        this.log('ERROR', `环境变量 ${envVar} 缺失`);
      }
    }
    
    // 测试 Supabase 连接
    try {
      const { data, error } = await this.supabase.from('teams').select('count').limit(1);
      if (error) {
        this.log('ERROR', 'Supabase 连接失败', error);
      } else {
        this.log('SUCCESS', 'Supabase 连接正常');
      }
    } catch (err) {
      this.log('ERROR', 'Supabase 连接异常', err.message);
    }
  }

  // 检查数据库表结构
  async checkDatabaseTables() {
    console.log('\n🗄️ 检查数据库表结构...');
    
    const tables = ['teams', 'team_members', 'user_profiles'];
    
    for (const table of tables) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (error) {
          this.log('ERROR', `表 ${table} 访问失败`, error);
        } else {
          this.log('SUCCESS', `表 ${table} 存在且可访问`);
          
          // 检查表中的数据
          const { count } = await this.supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          this.log('INFO', `表 ${table} 包含 ${count} 条记录`);
        }
      } catch (err) {
        this.log('ERROR', `表 ${table} 检查异常`, err.message);
      }
    }
  }

  // 检查数据库函数
  async checkDatabaseFunctions() {
    console.log('\n⚙️ 检查数据库函数...');
    
    const functions = [
      'get_user_id_by_email',
      'get_user_id_by_username',
      'is_user_team_member',
      'add_team_member_safe',
      'create_user_profile'
    ];
    
    for (const funcName of functions) {
      try {
        // 尝试调用函数（使用测试参数）
        let testParams = {};
        
        if (funcName === 'get_user_id_by_email') {
          testParams = { email: 'test@example.com' };
        } else if (funcName === 'get_user_id_by_username') {
          testParams = { username: 'testuser' };
        } else if (funcName === 'is_user_team_member') {
          testParams = { user_id: 'test-user-id', team_id: 'test-team-id' };
        } else if (funcName === 'add_team_member_safe') {
          testParams = { team_id: 'test-team-id', user_id: 'test-user-id' };
        } else if (funcName === 'create_user_profile') {
          testParams = { user_id: 'test-user-id', username: 'testuser', display_name: 'Test User' };
        }
        
        const { data, error } = await this.supabase.rpc(funcName, testParams);
        
        if (error) {
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            this.log('ERROR', `函数 ${funcName} 不存在`, error);
          } else {
            this.log('WARNING', `函数 ${funcName} 存在但测试调用失败（可能是正常的）`, error.message);
          }
        } else {
          this.log('SUCCESS', `函数 ${funcName} 存在且可调用`);
        }
      } catch (err) {
        this.log('ERROR', `函数 ${funcName} 检查异常`, err.message);
      }
    }
  }

  // 检查 RLS 策略
  async checkRLSPolicies() {
    console.log('\n🔒 检查 RLS 策略...');
    
    try {
      // 检查 teams 表的 RLS
      const { data: teamsRLS, error: teamsError } = await this.supabase
        .rpc('sql', { 
          query: `
            SELECT schemaname, tablename, rowsecurity 
            FROM pg_tables 
            WHERE tablename IN ('teams', 'team_members', 'user_profiles')
          `
        });
        
      if (teamsError) {
        this.log('WARNING', 'RLS 状态检查失败，使用替代方法', teamsError.message);
        
        // 尝试直接访问表来测试 RLS
        const tables = ['teams', 'team_members', 'user_profiles'];
        for (const table of tables) {
          try {
            const { data, error } = await this.supabase.from(table).select('*').limit(1);
            if (error) {
              this.log('WARNING', `表 ${table} 的 RLS 可能阻止了访问`, error.message);
            } else {
              this.log('SUCCESS', `表 ${table} 可以正常访问`);
            }
          } catch (err) {
            this.log('ERROR', `表 ${table} 访问测试失败`, err.message);
          }
        }
      } else {
        this.log('SUCCESS', 'RLS 状态检查完成', teamsRLS);
      }
    } catch (err) {
      this.log('ERROR', 'RLS 检查异常', err.message);
    }
  }

  // 模拟邀请流程
  async simulateInviteProcess() {
    console.log('\n🎭 模拟邀请流程...');
    
    // 1. 测试通过邮箱查找用户
    try {
      this.log('INFO', '测试通过邮箱查找用户...');
      const { data: emailResult, error: emailError } = await this.supabase
        .rpc('get_user_id_by_email', { email: 'test@example.com' });
        
      if (emailError) {
        this.log('ERROR', '通过邮箱查找用户失败', emailError);
      } else {
        this.log('SUCCESS', '通过邮箱查找用户功能正常', { result: emailResult });
      }
    } catch (err) {
      this.log('ERROR', '邮箱查找测试异常', err.message);
    }
    
    // 2. 测试通过用户名查找用户
    try {
      this.log('INFO', '测试通过用户名查找用户...');
      const { data: usernameResult, error: usernameError } = await this.supabase
        .rpc('get_user_id_by_username', { username: 'testuser' });
        
      if (usernameError) {
        this.log('ERROR', '通过用户名查找用户失败', usernameError);
      } else {
        this.log('SUCCESS', '通过用户名查找用户功能正常', { result: usernameResult });
      }
    } catch (err) {
      this.log('ERROR', '用户名查找测试异常', err.message);
    }
    
    // 3. 测试团队成员检查
    try {
      this.log('INFO', '测试团队成员检查...');
      const { data: memberResult, error: memberError } = await this.supabase
        .rpc('is_user_team_member', { 
          user_id: 'test-user-id', 
          team_id: 'test-team-id' 
        });
        
      if (memberError) {
        this.log('ERROR', '团队成员检查失败', memberError);
      } else {
        this.log('SUCCESS', '团队成员检查功能正常', { result: memberResult });
      }
    } catch (err) {
      this.log('ERROR', '团队成员检查测试异常', err.message);
    }
  }

  // 检查实际数据
  async checkActualData() {
    console.log('\n📊 检查实际数据...');
    
    try {
      // 检查是否有真实的团队数据
      const { data: teams, error: teamsError } = await this.supabase
        .from('teams')
        .select('id, name, created_at')
        .limit(5);
        
      if (teamsError) {
        this.log('ERROR', '获取团队数据失败', teamsError);
      } else {
        this.log('SUCCESS', `找到 ${teams.length} 个团队`);
        teams.forEach(team => {
          this.log('INFO', `团队: ${team.name} (ID: ${team.id})`);
        });
        
        // 对每个团队检查成员
        for (const team of teams) {
          try {
            const { data: members, error: membersError } = await this.supabase
              .from('team_members')
              .select('user_id, role')
              .eq('team_id', team.id);
              
            if (membersError) {
              this.log('ERROR', `获取团队 ${team.name} 的成员失败`, membersError);
            } else {
              this.log('INFO', `团队 ${team.name} 有 ${members.length} 个成员`);
            }
          } catch (err) {
            this.log('ERROR', `检查团队 ${team.name} 成员时异常`, err.message);
          }
        }
      }
    } catch (err) {
      this.log('ERROR', '检查实际数据时异常', err.message);
    }
    
    try {
      // 检查用户资料数据
      const { data: profiles, error: profilesError } = await this.supabase
        .from('user_profiles')
        .select('user_id, username, display_name')
        .limit(5);
        
      if (profilesError) {
        this.log('ERROR', '获取用户资料数据失败', profilesError);
      } else {
        this.log('SUCCESS', `找到 ${profiles.length} 个用户资料`);
        profiles.forEach(profile => {
          this.log('INFO', `用户: ${profile.display_name} (@${profile.username})`);
        });
      }
    } catch (err) {
      this.log('ERROR', '检查用户资料数据时异常', err.message);
    }
  }

  // 生成诊断报告
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 邀请功能错误诊断报告');
    console.log('='.repeat(80));
    
    console.log(`\n📊 统计信息:`);
    console.log(`   错误数量: ${this.errors.length}`);
    console.log(`   警告数量: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ 发现的错误:');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.timestamp}] ${error.message}`);
        if (error.details) {
          console.log(`      详情: ${JSON.stringify(error.details, null, 6)}`);
        }
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告信息:');
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. [${warning.timestamp}] ${warning.message}`);
        if (warning.details) {
          console.log(`      详情: ${JSON.stringify(warning.details, null, 6)}`);
        }
      });
    }
    
    console.log('\n🔧 修复建议:');
    
    if (this.errors.some(e => e.message.includes('环境变量'))) {
      console.log('   1. 检查 .env.local 文件是否存在且配置正确');
      console.log('   2. 确保 Supabase URL 和密钥正确');
    }
    
    if (this.errors.some(e => e.message.includes('函数') && e.message.includes('不存在'))) {
      console.log('   3. 在 Supabase Dashboard 中执行 fix-missing-components.sql');
      console.log('   4. 确保所有数据库函数已正确创建');
    }
    
    if (this.errors.some(e => e.message.includes('表') && e.message.includes('访问失败'))) {
      console.log('   5. 检查数据库表的 RLS 策略');
      console.log('   6. 确保服务角色密钥有足够权限');
    }
    
    if (this.errors.some(e => e.message.includes('连接'))) {
      console.log('   7. 检查网络连接和 Supabase 服务状态');
      console.log('   8. 验证 Supabase 项目是否正常运行');
    }
    
    console.log('\n📚 相关文档:');
    console.log('   - fix-missing-components.sql (数据库修复脚本)');
    console.log('   - FUNCTION_CONFLICT_FIX.md (详细修复指南)');
    console.log('   - .env.example (环境配置示例)');
    
    console.log('\n🎯 下一步操作:');
    if (this.errors.length === 0) {
      console.log('   ✅ 所有检查通过！邀请功能应该可以正常工作。');
      console.log('   📝 如果仍有问题，请检查前端代码的错误处理。');
    } else {
      console.log('   🔧 请按照上述修复建议解决错误');
      console.log('   🔄 修复后重新运行此诊断工具');
      console.log('   📞 如需帮助，请提供完整的错误信息');
    }
    
    console.log('\n' + '='.repeat(80));
  }

  // 运行完整诊断
  async runDiagnosis() {
    console.log('🚀 开始邀请功能错误诊断...');
    console.log('诊断时间:', new Date().toLocaleString());
    
    await this.checkEnvironment();
    await this.checkDatabaseTables();
    await this.checkDatabaseFunctions();
    await this.checkRLSPolicies();
    await this.simulateInviteProcess();
    await this.checkActualData();
    
    this.generateReport();
  }
}

// 运行诊断
if (require.main === module) {
  const diagnostic = new InviteErrorDiagnostic();
  diagnostic.runDiagnosis().catch(console.error);
}

module.exports = InviteErrorDiagnostic;