#!/usr/bin/env node

/**
 * 数据库修复执行脚本
 * 通过 Supabase 客户端创建必要的数据库组件
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

class DatabaseFixer {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  log(type, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    
    if (type === 'ERROR') {
      console.log(`❌ [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else if (type === 'SUCCESS') {
      console.log(`✅ [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else if (type === 'WARNING') {
      console.log(`⚠️  [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else {
      console.log(`ℹ️  [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    }
  }

  // 检查 user_profiles 表是否存在
  async checkUserProfilesTable() {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .limit(1);
        
      if (error && error.code === '42P01') {
        // 表不存在
        return false;
      } else if (error) {
        this.log('WARNING', 'user_profiles 表检查遇到其他错误', error);
        return false;
      } else {
        return true;
      }
    } catch (err) {
      this.log('WARNING', 'user_profiles 表检查异常', err.message);
      return false;
    }
  }

  // 测试数据库函数
  async testDatabaseFunctions() {
    console.log('\n🔍 测试数据库函数...');
    
    const functions = [
      { name: 'get_user_id_by_email', params: { email: 'test@example.com' } },
      { name: 'get_user_id_by_username', params: { username: 'testuser' } },
      { name: 'is_user_team_member', params: { team_id: 'test-team', user_id: 'test-user' } },
      { name: 'add_team_member_safe', params: { team_id: 'test-team', user_id: 'test-user' } },
      { name: 'create_user_profile', params: { user_id: 'test-user', username: 'testuser', display_name: 'Test User' } }
    ];

    const results = {};

    for (const func of functions) {
      try {
        const { data, error } = await this.supabase.rpc(func.name, func.params);
        
        if (error) {
          if (error.code === '42883') {
            this.log('ERROR', `函数 ${func.name} 不存在`);
            results[func.name] = false;
          } else {
            this.log('SUCCESS', `函数 ${func.name} 存在（返回错误但函数存在）`);
            results[func.name] = true;
          }
        } else {
          this.log('SUCCESS', `函数 ${func.name} 存在且正常工作`);
          results[func.name] = true;
        }
      } catch (err) {
        this.log('ERROR', `函数 ${func.name} 测试异常`, err.message);
        results[func.name] = false;
      }
    }

    return results;
  }

  // 检查现有数据
  async checkExistingData() {
    console.log('\n📊 检查现有数据...');
    
    try {
      // 检查团队数据
      const { data: teams, error: teamsError } = await this.supabase
        .from('teams')
        .select('id, name')
        .limit(5);
        
      if (teamsError) {
        this.log('ERROR', '无法获取团队数据', teamsError);
      } else {
        this.log('SUCCESS', `找到 ${teams.length} 个团队`);
        
        // 检查每个团队的成员
        for (const team of teams) {
          const { data: members, error: membersError } = await this.supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', team.id);
            
          if (membersError) {
            this.log('WARNING', `团队 "${team.name}" 成员查询失败`, membersError);
          } else {
            this.log('INFO', `团队 "${team.name}" 有 ${members.length} 个成员`);
            
            // 检查成员的用户配置文件
            if (members.length > 0) {
              const userIds = members.map(m => m.user_id);
              const { data: profiles, error: profilesError } = await this.supabase
                .from('user_profiles')
                .select('user_id, username, display_name')
                .in('user_id', userIds);
                
              if (profilesError) {
                this.log('WARNING', `团队 "${team.name}" 成员配置文件查询失败`, profilesError);
              } else {
                this.log('INFO', `团队 "${team.name}" 中 ${profiles.length}/${members.length} 个成员有配置文件`);
              }
            }
          }
        }
      }
    } catch (err) {
      this.log('ERROR', '检查现有数据时异常', err.message);
    }
  }

  // 创建测试用户配置文件
  async createTestUserProfile() {
    console.log('\n🧪 创建测试用户配置文件...');
    
    try {
      // 获取当前用户
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      
      if (authError || !user) {
        this.log('WARNING', '无法获取当前用户，跳过测试配置文件创建');
        return false;
      }

      // 检查是否已有配置文件
      const { data: existingProfile, error: checkError } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();
        
      if (existingProfile) {
        this.log('SUCCESS', '当前用户已有配置文件');
        return true;
      }

      // 创建配置文件
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          username: user.email?.split('@')[0] || 'user',
          display_name: user.email?.split('@')[0] || 'User',
          bio: '测试用户配置文件'
        })
        .select()
        .single();
        
      if (error) {
        this.log('ERROR', '创建测试用户配置文件失败', error);
        return false;
      } else {
        this.log('SUCCESS', '成功创建测试用户配置文件');
        return true;
      }
    } catch (err) {
      this.log('ERROR', '创建测试用户配置文件异常', err.message);
      return false;
    }
  }

  // 生成修复建议
  generateFixSuggestions(functionResults) {
    console.log('\n🔧 修复建议:');
    
    const missingFunctions = Object.entries(functionResults)
      .filter(([name, exists]) => !exists)
      .map(([name]) => name);

    if (missingFunctions.length === 0) {
      console.log('   ✅ 所有必要的数据库函数都存在！');
      console.log('\n📝 如果团队成员仍然不显示，请检查:');
      console.log('      1. 用户是否有 user_profiles 记录');
      console.log('      2. team_members 表中是否有正确的关联');
      console.log('      3. RLS 策略是否正确配置');
      return;
    }

    console.log(`   🚨 缺少 ${missingFunctions.length} 个数据库函数:`);
    missingFunctions.forEach(func => {
      console.log(`      - ${func}`);
    });

    console.log('\n   💡 修复步骤:');
    console.log('      1. 在 Supabase Dashboard 中打开 SQL Editor');
    console.log('      2. 复制并执行 fix-missing-components.sql 中的内容');
    console.log('      3. 或者联系数据库管理员手动创建这些函数');
    console.log('      4. 确保 user_profiles 表存在且有正确的 RLS 策略');
    
    console.log('\n   📋 SQL Editor 访问路径:');
    console.log('      Supabase Dashboard > Project > SQL Editor > New Query');
  }

  // 运行诊断
  async runDiagnosis() {
    console.log('🚀 开始数据库诊断...');
    console.log('诊断时间:', new Date().toLocaleString());
    
    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.log('ERROR', '缺少必要的环境变量');
      return false;
    }

    this.log('SUCCESS', '环境变量配置正确');

    // 检查 user_profiles 表
    const userProfilesExists = await this.checkUserProfilesTable();
    if (userProfilesExists) {
      this.log('SUCCESS', 'user_profiles 表存在');
    } else {
      this.log('ERROR', 'user_profiles 表不存在或无法访问');
    }

    // 测试数据库函数
    const functionResults = await this.testDatabaseFunctions();
    
    // 检查现有数据
    await this.checkExistingData();
    
    // 尝试创建测试用户配置文件
    if (userProfilesExists) {
      await this.createTestUserProfile();
    }

    // 生成修复建议
    this.generateFixSuggestions(functionResults);

    console.log('\n' + '='.repeat(80));
    console.log('📋 数据库诊断报告');
    console.log('='.repeat(80));
    
    const allFunctionsExist = Object.values(functionResults).every(exists => exists);
    
    if (allFunctionsExist && userProfilesExists) {
      console.log('\n🎉 数据库配置正常！');
      console.log('\n🎯 下一步:');
      console.log('   1. 重新运行 debug-frontend-errors.js');
      console.log('   2. 测试团队成员邀请功能');
      console.log('   3. 检查前端页面是否正常显示');
    } else {
      console.log('\n⚠️  发现数据库配置问题');
      console.log('\n🎯 下一步:');
      console.log('   1. 按照修复建议在 Supabase Dashboard 中执行 SQL');
      console.log('   2. 重新运行此诊断脚本验证修复');
      console.log('   3. 联系管理员获取帮助');
    }
    
    console.log('\n📚 相关文档:');
    console.log('   - fix-missing-components.sql (完整 SQL 脚本)');
    console.log('   - debug-frontend-errors.js (前端诊断)');
    console.log('   - Supabase Dashboard SQL Editor');
    
    console.log('\n' + '='.repeat(80));
    
    return allFunctionsExist && userProfilesExists;
  }
}

// 运行诊断
if (require.main === module) {
  const fixer = new DatabaseFixer();
  fixer.runDiagnosis().catch(console.error);
}

module.exports = DatabaseFixer;