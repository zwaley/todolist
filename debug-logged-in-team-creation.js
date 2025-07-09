// 调试已登录用户团队创建失败问题
// 专门针对用户确认已登录状态下的团队创建失败进行诊断

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

class LoggedInTeamCreationDebugger {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString()
    const prefix = {
      'INFO': '📋',
      'SUCCESS': '✅', 
      'WARNING': '⚠️',
      'ERROR': '❌'
    }[level] || '📋'
    
    console.log(`${prefix} [${timestamp}] ${message}`)
    if (data) {
      console.log('   详细信息:', JSON.stringify(data, null, 2))
    }
  }

  // 检查环境配置
  async checkEnvironment() {
    this.log('INFO', '检查环境配置...')
    
    const requiredEnvs = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    for (const env of requiredEnvs) {
      if (process.env[env]) {
        this.log('SUCCESS', `${env}: 已配置`)
      } else {
        this.log('ERROR', `${env}: 未配置`)
        return false
      }
    }
    
    return true
  }

  // 检查数据库连接
  async checkDatabaseConnection() {
    this.log('INFO', '检查数据库连接...')
    
    try {
      const { data, error } = await this.supabase
        .from('teams')
        .select('count')
        .limit(1)
      
      if (error) {
        this.log('ERROR', '数据库连接失败', error)
        return false
      }
      
      this.log('SUCCESS', '数据库连接正常')
      return true
    } catch (err) {
      this.log('ERROR', '数据库连接异常', err.message)
      return false
    }
  }

  // 检查表结构
  async checkTableStructure() {
    this.log('INFO', '检查表结构...')
    
    const tables = ['teams', 'team_members']
    
    for (const table of tables) {
      try {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1)
        
        if (error) {
          this.log('ERROR', `表 ${table} 访问失败`, error)
          return false
        }
        
        this.log('SUCCESS', `表 ${table} 结构正常`)
      } catch (err) {
        this.log('ERROR', `表 ${table} 检查异常`, err.message)
        return false
      }
    }
    
    return true
  }

  // 检查RLS策略
  async checkRLSPolicies() {
    this.log('INFO', '检查RLS策略...')
    
    try {
      // 检查teams表的INSERT策略
      const { data: teamsPolicies, error: teamsError } = await this.supabase
        .rpc('exec_sql', {
          sql: `
            SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies 
            WHERE tablename = 'teams' AND cmd = 'INSERT';
          `
        })
      
      if (teamsError) {
        this.log('WARNING', 'teams表RLS策略查询失败', teamsError)
      } else {
        this.log('SUCCESS', 'teams表INSERT策略', teamsPolicies)
      }
      
      // 检查team_members表的INSERT策略
      const { data: membersPolicies, error: membersError } = await this.supabase
        .rpc('exec_sql', {
          sql: `
            SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies 
            WHERE tablename = 'team_members' AND cmd = 'INSERT';
          `
        })
      
      if (membersError) {
        this.log('WARNING', 'team_members表RLS策略查询失败', membersError)
      } else {
        this.log('SUCCESS', 'team_members表INSERT策略', membersPolicies)
      }
      
    } catch (err) {
      this.log('WARNING', 'RLS策略检查异常', err.message)
    }
  }

  // 模拟团队创建流程
  async simulateTeamCreation() {
    this.log('INFO', '模拟团队创建流程...')
    
    const testTeamName = `测试团队_${Date.now()}`
    const testUserId = 'test-user-id' // 这里需要一个真实的用户ID
    
    try {
      // 步骤1: 检查团队名称是否存在
      this.log('INFO', '步骤1: 检查团队名称是否存在...')
      const { data: existingTeam, error: checkError } = await this.supabase
        .from('teams')
        .select('id')
        .eq('name', testTeamName)
        .single()
      
      if (checkError && checkError.code !== 'PGRST116') {
        this.log('ERROR', '检查团队名称失败', checkError)
        return false
      }
      
      if (existingTeam) {
        this.log('WARNING', '团队名称已存在')
        return false
      }
      
      this.log('SUCCESS', '团队名称可用')
      
      // 步骤2: 创建团队
      this.log('INFO', '步骤2: 创建团队...')
      const { data: team, error: teamError } = await this.supabase
        .from('teams')
        .insert({
          name: testTeamName,
          created_by: testUserId
        })
        .select()
        .single()
      
      if (teamError) {
        this.log('ERROR', '创建团队失败', teamError)
        return false
      }
      
      this.log('SUCCESS', '团队创建成功', { teamId: team.id, teamName: team.name })
      
      // 步骤3: 添加团队成员
      this.log('INFO', '步骤3: 添加团队成员...')
      const { error: memberError } = await this.supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: testUserId,
          role: 'owner'
        })
      
      if (memberError) {
        this.log('ERROR', '添加团队成员失败', memberError)
        
        // 清理：删除已创建的团队
        await this.supabase.from('teams').delete().eq('id', team.id)
        this.log('INFO', '已清理测试团队')
        return false
      }
      
      this.log('SUCCESS', '团队成员添加成功')
      
      // 清理测试数据
      await this.supabase.from('team_members').delete().eq('team_id', team.id)
      await this.supabase.from('teams').delete().eq('id', team.id)
      this.log('INFO', '已清理测试数据')
      
      return true
      
    } catch (err) {
      this.log('ERROR', '模拟团队创建异常', err.message)
      return false
    }
  }

  // 检查现有用户
  async checkExistingUsers() {
    this.log('INFO', '检查现有用户...')
    
    try {
      const { data: users, error } = await this.supabase.auth.admin.listUsers()
      
      if (error) {
        this.log('ERROR', '获取用户列表失败', error)
        return null
      }
      
      if (users.users.length === 0) {
        this.log('WARNING', '系统中没有用户')
        return null
      }
      
      const firstUser = users.users[0]
      this.log('SUCCESS', `找到用户: ${firstUser.email}`, { userId: firstUser.id })
      return firstUser.id
      
    } catch (err) {
      this.log('ERROR', '检查用户异常', err.message)
      return null
    }
  }

  // 使用真实用户测试团队创建
  async testWithRealUser() {
    this.log('INFO', '使用真实用户测试团队创建...')
    
    const userId = await this.checkExistingUsers()
    if (!userId) {
      this.log('ERROR', '没有可用的测试用户')
      return false
    }
    
    const testTeamName = `真实测试团队_${Date.now()}`
    
    try {
      // 创建团队
      const { data: team, error: teamError } = await this.supabase
        .from('teams')
        .insert({
          name: testTeamName,
          created_by: userId
        })
        .select()
        .single()
      
      if (teamError) {
        this.log('ERROR', '使用真实用户创建团队失败', teamError)
        return false
      }
      
      this.log('SUCCESS', '使用真实用户创建团队成功', { teamId: team.id })
      
      // 添加团队成员
      const { error: memberError } = await this.supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          role: 'owner'
        })
      
      if (memberError) {
        this.log('ERROR', '使用真实用户添加团队成员失败', memberError)
        
        // 清理
        await this.supabase.from('teams').delete().eq('id', team.id)
        return false
      }
      
      this.log('SUCCESS', '使用真实用户添加团队成员成功')
      
      // 清理测试数据
      await this.supabase.from('team_members').delete().eq('team_id', team.id)
      await this.supabase.from('teams').delete().eq('id', team.id)
      this.log('INFO', '已清理真实用户测试数据')
      
      return true
      
    } catch (err) {
      this.log('ERROR', '真实用户测试异常', err.message)
      return false
    }
  }

  // 主要诊断流程
  async diagnose() {
    console.log('🔍 开始诊断已登录用户团队创建失败问题...\n')
    
    // 1. 检查环境配置
    const envOk = await this.checkEnvironment()
    if (!envOk) {
      this.log('ERROR', '环境配置有问题，请检查.env文件')
      return
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 2. 检查数据库连接
    const dbOk = await this.checkDatabaseConnection()
    if (!dbOk) {
      this.log('ERROR', '数据库连接有问题')
      return
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 3. 检查表结构
    const tableOk = await this.checkTableStructure()
    if (!tableOk) {
      this.log('ERROR', '表结构有问题')
      return
    }
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 4. 检查RLS策略
    await this.checkRLSPolicies()
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 5. 使用真实用户测试
    const realUserOk = await this.testWithRealUser()
    
    console.log('\n' + '='.repeat(50) + '\n')
    
    // 总结
    if (realUserOk) {
      this.log('SUCCESS', '诊断完成：团队创建功能正常，问题可能在前端或特定用户状态')
      this.log('INFO', '建议检查：')
      console.log('   1. 前端表单提交是否正确')
      console.log('   2. 用户的具体认证状态')
      console.log('   3. 浏览器网络请求是否成功')
      console.log('   4. 是否有JavaScript错误')
    } else {
      this.log('ERROR', '诊断完成：团队创建功能存在问题')
      this.log('INFO', '需要进一步检查数据库配置和RLS策略')
    }
  }
}

// 运行诊断
if (require.main === module) {
  const debugger = new LoggedInTeamCreationDebugger()
  debugger.diagnose().catch(console.error)
}

module.exports = LoggedInTeamCreationDebugger