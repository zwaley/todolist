#!/usr/bin/env node

/**
 * 为现有团队成员创建缺失的 user_profiles 记录
 * 解决团队成员不显示的问题
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

class ProfileCreator {
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

  // 获取所有团队成员的用户ID
  async getAllTeamMemberUserIds() {
    try {
      const { data: members, error } = await this.supabase
        .from('team_members')
        .select('user_id, team_id');
        
      if (error) {
        this.log('ERROR', '获取团队成员失败', error);
        return [];
      }
      
      this.log('SUCCESS', `找到 ${members.length} 个团队成员记录`);
      return members;
    } catch (err) {
      this.log('ERROR', '获取团队成员异常', err.message);
      return [];
    }
  }

  // 获取现有的用户配置文件
  async getExistingProfiles(userIds) {
    try {
      const { data: profiles, error } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .in('user_id', userIds);
        
      if (error) {
        this.log('ERROR', '获取现有配置文件失败', error);
        return [];
      }
      
      const existingUserIds = profiles.map(p => p.user_id);
      this.log('SUCCESS', `找到 ${existingUserIds.length} 个现有配置文件`);
      return existingUserIds;
    } catch (err) {
      this.log('ERROR', '获取现有配置文件异常', err.message);
      return [];
    }
  }

  // 从 auth.users 获取用户信息
  async getUserAuthInfo(userIds) {
    try {
      // 注意：这需要 service role key 才能访问 auth.users
      const { data: users, error } = await this.supabase
        .from('auth.users')
        .select('id, email, raw_user_meta_data')
        .in('id', userIds);
        
      if (error) {
        this.log('WARNING', '无法直接访问 auth.users 表', error);
        return [];
      }
      
      this.log('SUCCESS', `获取到 ${users.length} 个用户的认证信息`);
      return users;
    } catch (err) {
      this.log('WARNING', '获取用户认证信息异常', err.message);
      return [];
    }
  }

  // 为用户创建配置文件
  async createUserProfile(userId, email = null, metadata = null) {
    try {
      // 生成用户名和显示名
      let username = `user_${userId.substring(0, 8)}`;
      let displayName = `User ${userId.substring(0, 8)}`;
      
      if (email) {
        username = email.split('@')[0];
        displayName = email.split('@')[0];
      }
      
      if (metadata && metadata.full_name) {
        displayName = metadata.full_name;
      }
      
      if (metadata && metadata.user_name) {
        username = metadata.user_name;
      }

      const profileData = {
        user_id: userId,
        username: username,
        display_name: displayName,
        bio: '自动创建的用户配置文件',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert(profileData)
        .select()
        .single();
        
      if (error) {
        this.log('ERROR', `为用户 ${userId} 创建配置文件失败`, error);
        return false;
      } else {
        this.log('SUCCESS', `为用户 ${userId} 创建配置文件成功 (${username})`);
        return true;
      }
    } catch (err) {
      this.log('ERROR', `为用户 ${userId} 创建配置文件异常`, err.message);
      return false;
    }
  }

  // 使用 RPC 函数创建配置文件
  async createUserProfileViaRPC(userId, email = null) {
    try {
      let username = `user_${userId.substring(0, 8)}`;
      let displayName = `User ${userId.substring(0, 8)}`;
      
      if (email) {
        username = email.split('@')[0];
        displayName = email.split('@')[0];
      }

      const { data, error } = await this.supabase.rpc('create_user_profile', {
        user_id: userId,
        username: username,
        display_name: displayName
      });
        
      if (error) {
        this.log('ERROR', `通过 RPC 为用户 ${userId} 创建配置文件失败`, error);
        return false;
      } else {
        this.log('SUCCESS', `通过 RPC 为用户 ${userId} 创建配置文件成功 (${username})`);
        return true;
      }
    } catch (err) {
      this.log('ERROR', `通过 RPC 为用户 ${userId} 创建配置文件异常`, err.message);
      return false;
    }
  }

  // 运行配置文件创建流程
  async createMissingProfiles() {
    console.log('🚀 开始创建缺失的用户配置文件...');
    console.log('执行时间:', new Date().toLocaleString());
    
    // 检查环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.log('ERROR', '缺少必要的环境变量');
      return false;
    }

    // 获取所有团队成员
    const teamMembers = await this.getAllTeamMemberUserIds();
    if (teamMembers.length === 0) {
      this.log('WARNING', '没有找到团队成员');
      return true;
    }

    // 获取唯一的用户ID
    const uniqueUserIds = [...new Set(teamMembers.map(m => m.user_id))];
    this.log('INFO', `需要检查 ${uniqueUserIds.length} 个唯一用户`);

    // 获取现有配置文件
    const existingProfileUserIds = await this.getExistingProfiles(uniqueUserIds);
    
    // 找出缺失配置文件的用户
    const missingProfileUserIds = uniqueUserIds.filter(id => !existingProfileUserIds.includes(id));
    
    if (missingProfileUserIds.length === 0) {
      this.log('SUCCESS', '所有用户都已有配置文件！');
      return true;
    }

    this.log('INFO', `需要为 ${missingProfileUserIds.length} 个用户创建配置文件`);

    // 尝试获取用户认证信息
    const authUsers = await this.getUserAuthInfo(missingProfileUserIds);
    const authUserMap = new Map(authUsers.map(u => [u.id, u]));

    // 为每个缺失配置文件的用户创建配置文件
    let successCount = 0;
    let failCount = 0;

    for (const userId of missingProfileUserIds) {
      const authUser = authUserMap.get(userId);
      
      // 首先尝试使用 RPC 函数
      let success = await this.createUserProfileViaRPC(
        userId, 
        authUser?.email
      );
      
      // 如果 RPC 失败，尝试直接插入
      if (!success) {
        this.log('INFO', `RPC 方法失败，尝试直接插入用户 ${userId}`);
        success = await this.createUserProfile(
          userId,
          authUser?.email,
          authUser?.raw_user_meta_data
        );
      }
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 配置文件创建报告');
    console.log('='.repeat(80));
    
    console.log(`\n📊 统计信息:`);
    console.log(`   总用户数: ${uniqueUserIds.length}`);
    console.log(`   已有配置文件: ${existingProfileUserIds.length}`);
    console.log(`   需要创建: ${missingProfileUserIds.length}`);
    console.log(`   创建成功: ${successCount}`);
    console.log(`   创建失败: ${failCount}`);
    
    if (successCount > 0) {
      console.log('\n🎉 配置文件创建完成！');
      console.log('\n🎯 下一步:');
      console.log('   1. 重新运行 debug-frontend-errors.js 验证修复');
      console.log('   2. 访问团队页面检查成员显示');
      console.log('   3. 测试邀请功能');
    } else if (failCount > 0) {
      console.log('\n⚠️  配置文件创建遇到问题');
      console.log('\n🎯 建议:');
      console.log('   1. 检查 Supabase 权限设置');
      console.log('   2. 确认 user_profiles 表结构正确');
      console.log('   3. 检查 RLS 策略配置');
    }
    
    console.log('\n📚 相关文档:');
    console.log('   - debug-frontend-errors.js (前端诊断)');
    console.log('   - execute-database-fix.js (数据库诊断)');
    
    console.log('\n' + '='.repeat(80));
    
    return successCount > 0;
  }
}

// 运行配置文件创建
if (require.main === module) {
  const creator = new ProfileCreator();
  creator.createMissingProfiles().catch(console.error);
}

module.exports = ProfileCreator;