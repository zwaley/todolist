#!/usr/bin/env node

/**
 * 前端错误诊断工具
 * 检查团队页面和邀请功能的前端问题
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class FrontendErrorDiagnostic {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.issues = [];
    this.suggestions = [];
  }

  log(type, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, type, message, details };
    
    if (type === 'ERROR') {
      this.issues.push(logEntry);
      console.log(`❌ [${timestamp}] ${message}`);
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    } else if (type === 'WARNING') {
      this.suggestions.push(logEntry);
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

  // 检查团队页面文件
  checkTeamPageFiles() {
    console.log('\n📁 检查团队页面文件...');
    
    const teamFiles = [
      'src/app/teams/[id]/page.tsx',
      'src/app/teams/[id]/actions.ts',
      'src/app/teams/[id]/enhanced-invite-form.tsx'
    ];
    
    teamFiles.forEach(filePath => {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        this.log('SUCCESS', `文件存在: ${filePath}`);
        
        // 检查文件内容
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // 检查常见问题
          if (filePath.includes('page.tsx')) {
            this.checkTeamPageContent(content, filePath);
          } else if (filePath.includes('actions.ts')) {
            this.checkActionsContent(content, filePath);
          } else if (filePath.includes('invite-form')) {
            this.checkInviteFormContent(content, filePath);
          }
        } catch (err) {
          this.log('ERROR', `读取文件失败: ${filePath}`, err.message);
        }
      } else {
        this.log('ERROR', `文件缺失: ${filePath}`);
      }
    });
  }

  // 检查团队页面内容
  checkTeamPageContent(content, filePath) {
    console.log(`\n🔍 分析 ${filePath}...`);
    
    // 检查是否有错误处理
    if (!content.includes('try') && !content.includes('catch')) {
      this.log('WARNING', '团队页面缺少错误处理');
    }
    
    // 检查是否有加载状态
    if (!content.includes('loading') && !content.includes('Loading')) {
      this.log('WARNING', '团队页面缺少加载状态显示');
    }
    
    // 检查是否有团队成员显示
    if (content.includes('team_members') || content.includes('teamMembers')) {
      this.log('SUCCESS', '团队页面包含成员显示逻辑');
    } else {
      this.log('ERROR', '团队页面缺少成员显示逻辑');
    }
    
    // 检查是否有邀请功能
    if (content.includes('invite') || content.includes('Invite')) {
      this.log('SUCCESS', '团队页面包含邀请功能');
    } else {
      this.log('WARNING', '团队页面可能缺少邀请功能');
    }
  }

  // 检查 actions 文件内容
  checkActionsContent(content, filePath) {
    console.log(`\n🔍 分析 ${filePath}...`);
    
    // 检查必要的函数
    const requiredFunctions = [
      'inviteMember',
      'get_user_id_by_email',
      'get_user_id_by_username'
    ];
    
    requiredFunctions.forEach(func => {
      if (content.includes(func)) {
        this.log('SUCCESS', `包含函数: ${func}`);
      } else {
        this.log('ERROR', `缺少函数: ${func}`);
      }
    });
    
    // 检查错误处理
    if (content.includes('throw new Error') || content.includes('catch')) {
      this.log('SUCCESS', 'Actions 包含错误处理');
    } else {
      this.log('WARNING', 'Actions 缺少错误处理');
    }
    
    // 检查参数验证
    if (content.includes('trim()') || content.includes('validate')) {
      this.log('SUCCESS', 'Actions 包含输入验证');
    } else {
      this.log('WARNING', 'Actions 缺少输入验证');
    }
  }

  // 检查邀请表单内容
  checkInviteFormContent(content, filePath) {
    console.log(`\n🔍 分析 ${filePath}...`);
    
    // 检查表单元素
    if (content.includes('form') || content.includes('Form')) {
      this.log('SUCCESS', '包含表单元素');
    } else {
      this.log('ERROR', '缺少表单元素');
    }
    
    // 检查错误显示
    if (content.includes('error') && content.includes('Error')) {
      this.log('SUCCESS', '包含错误显示逻辑');
    } else {
      this.log('WARNING', '缺少错误显示逻辑');
    }
    
    // 检查提交处理
    if (content.includes('onSubmit') || content.includes('handleSubmit')) {
      this.log('SUCCESS', '包含提交处理逻辑');
    } else {
      this.log('ERROR', '缺少提交处理逻辑');
    }
  }

  // 测试数据库连接和数据
  async testDatabaseConnection() {
    console.log('\n🔗 测试数据库连接和数据...');
    
    try {
      // 测试团队数据
      const { data: teams, error: teamsError } = await this.supabase
        .from('teams')
        .select('id, name, description, created_at')
        .limit(5);
        
      if (teamsError) {
        this.log('ERROR', '获取团队数据失败', teamsError);
      } else {
        this.log('SUCCESS', `找到 ${teams.length} 个团队`);
        
        // 为每个团队测试成员数据
        for (const team of teams) {
          try {
            const { data: members, error: membersError } = await this.supabase
              .from('team_members')
              .select(`
                user_id,
                role,
                joined_at,
                user_profiles!inner(
                  username,
                  display_name
                )
              `)
              .eq('team_id', team.id);
              
            if (membersError) {
              this.log('ERROR', `获取团队 "${team.name}" 成员失败`, membersError);
            } else {
              this.log('SUCCESS', `团队 "${team.name}" 有 ${members.length} 个成员`);
              
              // 显示成员详情
              members.forEach(member => {
                const profile = member.user_profiles;
                this.log('INFO', `  - ${profile.display_name} (@${profile.username}) - ${member.role}`);
              });
            }
          } catch (err) {
            this.log('ERROR', `检查团队 "${team.name}" 成员时异常`, err.message);
          }
        }
      }
    } catch (err) {
      this.log('ERROR', '数据库连接测试失败', err.message);
    }
  }

  // 测试邀请功能的数据库函数
  async testInviteFunctions() {
    console.log('\n⚙️ 测试邀请功能的数据库函数...');
    
    // 测试 get_user_id_by_email
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_id_by_email', { email: 'test@example.com' });
        
      if (error) {
        this.log('ERROR', 'get_user_id_by_email 函数调用失败', error);
      } else {
        this.log('SUCCESS', 'get_user_id_by_email 函数正常', { result: data });
      }
    } catch (err) {
      this.log('ERROR', 'get_user_id_by_email 函数测试异常', err.message);
    }
    
    // 测试 get_user_id_by_username
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_id_by_username', { username: 'testuser' });
        
      if (error) {
        this.log('ERROR', 'get_user_id_by_username 函数调用失败', error);
      } else {
        this.log('SUCCESS', 'get_user_id_by_username 函数正常', { result: data });
      }
    } catch (err) {
      this.log('ERROR', 'get_user_id_by_username 函数测试异常', err.message);
    }
    
    // 测试 add_team_member_safe
    try {
      const { data, error } = await this.supabase
        .rpc('add_team_member_safe', { 
          team_id: 999999, // 使用不存在的团队ID进行测试
          user_id: 'test-user-id' 
        });
        
      if (error) {
        this.log('ERROR', 'add_team_member_safe 函数调用失败', error);
      } else {
        this.log('SUCCESS', 'add_team_member_safe 函数正常', { result: data });
      }
    } catch (err) {
      this.log('ERROR', 'add_team_member_safe 函数测试异常', err.message);
    }
  }

  // 检查环境变量和配置
  checkConfiguration() {
    console.log('\n⚙️ 检查配置...');
    
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    requiredEnvVars.forEach(envVar => {
      if (process.env[envVar]) {
        this.log('SUCCESS', `环境变量 ${envVar} 已配置`);
      } else {
        this.log('ERROR', `环境变量 ${envVar} 缺失`);
      }
    });
    
    // 检查 Supabase 客户端文件
    const clientPath = path.join(process.cwd(), 'src/lib/supabase/client.ts');
    if (fs.existsSync(clientPath)) {
      this.log('SUCCESS', 'Supabase 客户端文件存在');
      
      try {
        const content = fs.readFileSync(clientPath, 'utf8');
        if (content.includes('createClient')) {
          this.log('SUCCESS', 'Supabase 客户端配置正确');
        } else {
          this.log('ERROR', 'Supabase 客户端配置可能有问题');
        }
      } catch (err) {
        this.log('ERROR', '读取 Supabase 客户端文件失败', err.message);
      }
    } else {
      this.log('ERROR', 'Supabase 客户端文件缺失');
    }
  }

  // 生成修复建议
  generateFixSuggestions() {
    console.log('\n🔧 修复建议:');
    
    if (this.issues.length === 0) {
      console.log('   ✅ 未发现明显的前端问题！');
      console.log('   📝 如果团队成员仍然不显示，请检查:');
      console.log('      1. 浏览器控制台是否有 JavaScript 错误');
      console.log('      2. 网络请求是否成功（开发者工具 > Network）');
      console.log('      3. 数据库中是否有实际的团队成员数据');
      return;
    }
    
    console.log('\n   🚨 发现的问题:');
    this.issues.forEach((issue, index) => {
      console.log(`      ${index + 1}. ${issue.message}`);
    });
    
    console.log('\n   💡 修复步骤:');
    
    if (this.issues.some(i => i.message.includes('文件缺失'))) {
      console.log('      1. 创建缺失的文件');
      console.log('      2. 参考现有文件结构进行实现');
    }
    
    if (this.issues.some(i => i.message.includes('成员显示逻辑'))) {
      console.log('      3. 在团队页面添加成员列表组件');
      console.log('      4. 确保正确查询 team_members 表');
    }
    
    if (this.issues.some(i => i.message.includes('错误处理'))) {
      console.log('      5. 添加 try-catch 错误处理');
      console.log('      6. 显示用户友好的错误消息');
    }
    
    if (this.issues.some(i => i.message.includes('函数'))) {
      console.log('      7. 在 Supabase Dashboard 执行 fix-missing-components.sql');
      console.log('      8. 验证数据库函数是否正确创建');
    }
  }

  // 生成诊断报告
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📋 前端错误诊断报告');
    console.log('='.repeat(80));
    
    console.log(`\n📊 统计信息:`);
    console.log(`   错误数量: ${this.issues.length}`);
    console.log(`   建议数量: ${this.suggestions.length}`);
    
    this.generateFixSuggestions();
    
    console.log('\n📚 相关文档:');
    console.log('   - fix-missing-components.sql (数据库修复)');
    console.log('   - debug-invite-errors.js (后端诊断)');
    console.log('   - CODE_QUALITY_IMPROVEMENTS.md (代码改进指南)');
    
    console.log('\n🎯 下一步操作:');
    if (this.issues.length === 0) {
      console.log('   1. 检查浏览器控制台错误');
      console.log('   2. 验证数据库中是否有团队成员数据');
      console.log('   3. 运行 debug-invite-errors.js 检查后端');
    } else {
      console.log('   1. 按照修复建议解决问题');
      console.log('   2. 重新运行此诊断工具');
      console.log('   3. 测试团队页面功能');
    }
    
    console.log('\n' + '='.repeat(80));
  }

  // 运行完整诊断
  async runDiagnosis() {
    console.log('🚀 开始前端错误诊断...');
    console.log('诊断时间:', new Date().toLocaleString());
    
    this.checkConfiguration();
    this.checkTeamPageFiles();
    await this.testDatabaseConnection();
    await this.testInviteFunctions();
    
    this.generateReport();
  }
}

// 运行诊断
if (require.main === module) {
  const diagnostic = new FrontendErrorDiagnostic();
  diagnostic.runDiagnosis().catch(console.error);
}

module.exports = FrontendErrorDiagnostic;