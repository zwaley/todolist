#!/usr/bin/env node

/**
 * 测试团队成员显示功能
 * 直接验证数据库查询和前端逻辑
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

class TeamMemberTester {
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

  // 测试基本的团队成员查询
  async testBasicTeamMemberQuery(teamId) {
    console.log(`\n🔍 测试团队 ${teamId} 的基本成员查询...`);
    
    try {
      const { data: members, error } = await this.supabase
        .from('team_members')
        .select('user_id, role, joined_at')
        .eq('team_id', teamId);
        
      if (error) {
        this.log('ERROR', `基本查询失败`, error);
        return null;
      }
      
      this.log('SUCCESS', `找到 ${members.length} 个团队成员`);
      members.forEach((member, index) => {
        console.log(`   ${index + 1}. 用户ID: ${member.user_id}, 角色: ${member.role}`);
      });
      
      return members;
    } catch (err) {
      this.log('ERROR', '基本查询异常', err.message);
      return null;
    }
  }

  // 测试带用户配置文件的查询
  async testTeamMemberWithProfiles(teamId) {
    console.log(`\n👤 测试团队 ${teamId} 的成员配置文件查询...`);
    
    try {
      const { data: members, error } = await this.supabase
        .from('team_members')
        .select(`
          user_id,
          role,
          joined_at,
          user_profiles!inner(
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('team_id', teamId);
        
      if (error) {
        this.log('ERROR', `配置文件查询失败`, error);
        return null;
      }
      
      this.log('SUCCESS', `找到 ${members.length} 个有配置文件的团队成员`);
      members.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.user_profiles.display_name} (@${member.user_profiles.username})`);
        console.log(`      角色: ${member.role}, 加入时间: ${member.joined_at}`);
      });
      
      return members;
    } catch (err) {
      this.log('ERROR', '配置文件查询异常', err.message);
      return null;
    }
  }

  // 测试左连接查询（包括没有配置文件的用户）
  async testTeamMemberWithLeftJoin(teamId) {
    console.log(`\n🔗 测试团队 ${teamId} 的左连接查询...`);
    
    try {
      const { data: members, error } = await this.supabase
        .from('team_members')
        .select(`
          user_id,
          role,
          joined_at,
          user_profiles(
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('team_id', teamId);
        
      if (error) {
        this.log('ERROR', `左连接查询失败`, error);
        return null;
      }
      
      this.log('SUCCESS', `找到 ${members.length} 个团队成员（包括无配置文件的）`);
      members.forEach((member, index) => {
        if (member.user_profiles) {
          console.log(`   ${index + 1}. ${member.user_profiles.display_name} (@${member.user_profiles.username})`);
        } else {
          console.log(`   ${index + 1}. 用户ID: ${member.user_id} (无配置文件)`);
        }
        console.log(`      角色: ${member.role}, 加入时间: ${member.joined_at}`);
      });
      
      return members;
    } catch (err) {
      this.log('ERROR', '左连接查询异常', err.message);
      return null;
    }
  }

  // 检查用户配置文件表
  async checkUserProfiles() {
    console.log(`\n📋 检查用户配置文件表...`);
    
    try {
      const { data: profiles, error } = await this.supabase
        .from('user_profiles')
        .select('user_id, username, display_name')
        .limit(10);
        
      if (error) {
        this.log('ERROR', `用户配置文件查询失败`, error);
        return null;
      }
      
      this.log('SUCCESS', `找到 ${profiles.length} 个用户配置文件`);
      profiles.forEach((profile, index) => {
        console.log(`   ${index + 1}. ${profile.display_name} (@${profile.username}) - ${profile.user_id}`);
      });
      
      return profiles;
    } catch (err) {
      this.log('ERROR', '用户配置文件查询异常', err.message);
      return null;
    }
  }

  // 测试邀请功能
  async testInviteFunction() {
    console.log(`\n📧 测试邀请功能...`);
    
    try {
      // 测试通过邮箱查找用户
      const { data: emailResult, error: emailError } = await this.supabase
        .rpc('get_user_id_by_email', { email: 'test@example.com' });
        
      if (emailError) {
        this.log('WARNING', '邮箱查找函数测试失败', emailError);
      } else {
        this.log('SUCCESS', '邮箱查找函数正常工作');
      }
      
      // 测试通过用户名查找用户
      const { data: usernameResult, error: usernameError } = await this.supabase
        .rpc('get_user_id_by_username', { username: 'testuser' });
        
      if (usernameError) {
        this.log('WARNING', '用户名查找函数测试失败', usernameError);
      } else {
        this.log('SUCCESS', '用户名查找函数正常工作');
      }
      
      // 测试添加团队成员函数
      const { data: addResult, error: addError } = await this.supabase
        .rpc('add_team_member_safe', { 
          team_id: 'test-team', 
          user_id: 'test-user' 
        });
        
      if (addError) {
        this.log('WARNING', '添加团队成员函数测试失败', addError);
      } else {
        this.log('SUCCESS', '添加团队成员函数正常工作');
      }
      
    } catch (err) {
      this.log('ERROR', '邀请功能测试异常', err.message);
    }
  }

  // 运行完整测试
  async runTests() {
    console.log('🚀 开始团队成员功能测试...');
    console.log('测试时间:', new Date().toLocaleString());
    
    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.log('ERROR', '缺少必要的环境变量');
      return false;
    }

    // 获取所有团队
    console.log('\n📊 获取团队列表...');
    const { data: teams, error: teamsError } = await this.supabase
      .from('teams')
      .select('id, name')
      .limit(5);
      
    if (teamsError) {
      this.log('ERROR', '获取团队列表失败', teamsError);
      return false;
    }
    
    this.log('SUCCESS', `找到 ${teams.length} 个团队`);
    
    // 检查用户配置文件
    await this.checkUserProfiles();
    
    // 为每个团队运行测试
    for (const team of teams) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏢 测试团队: ${team.name} (ID: ${team.id})`);
      console.log('='.repeat(60));
      
      // 基本查询
      const basicMembers = await this.testBasicTeamMemberQuery(team.id);
      
      if (basicMembers && basicMembers.length > 0) {
        // 带配置文件的查询
        await this.testTeamMemberWithProfiles(team.id);
        
        // 左连接查询
        await this.testTeamMemberWithLeftJoin(team.id);
      } else {
        console.log('   ⚠️  团队没有成员，跳过配置文件测试');
      }
    }
    
    // 测试邀请功能
    await this.testInviteFunction();
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 测试总结');
    console.log('='.repeat(80));
    
    console.log('\n🎯 如果看到以上测试结果:');
    console.log('   ✅ 基本查询成功 = 数据库连接正常');
    console.log('   ✅ 配置文件查询成功 = 用户配置文件存在');
    console.log('   ✅ 邀请功能测试成功 = 数据库函数正常');
    
    console.log('\n🔧 如果团队成员仍然不显示:');
    console.log('   1. 检查前端页面的查询语句');
    console.log('   2. 检查 RLS 策略是否正确');
    console.log('   3. 检查用户权限设置');
    console.log('   4. 查看浏览器开发者工具的网络请求');
    
    console.log('\n📚 相关文件:');
    console.log('   - src/app/teams/[id]/page.tsx (前端页面)');
    console.log('   - src/app/teams/[id]/actions.ts (后端操作)');
    console.log('   - src/app/teams/[id]/enhanced-invite-form.tsx (邀请表单)');
    
    console.log('\n' + '='.repeat(80));
    
    return true;
  }
}

// 运行测试
if (require.main === module) {
  const tester = new TeamMemberTester();
  tester.runTests().catch(console.error);
}

module.exports = TeamMemberTester;