// 团队创建调试脚本
// 用于诊断NEXT_REDIRECT错误和数据库连接问题

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 手动读取.env.local文件
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env.local')
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
  } catch (error) {
    console.log('⚠️ 无法读取.env.local文件:', error.message)
  }
}

loadEnvFile()

async function debugTeamCreation() {
  console.log('🔍 开始调试团队创建功能...')
  
  // 1. 检查环境变量
  console.log('\n📋 检查环境变量:')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 已设置' : '❌ 未设置')
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 已设置' : '❌ 未设置')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 已设置' : '❌ 未设置')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ 环境变量配置不完整，请检查.env.local文件')
    return
  }
  
  // 2. 创建Supabase客户端
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    // 3. 测试数据库连接
    console.log('\n🔗 测试数据库连接...')
    const { data: connectionTest, error: connectionError } = await supabase
      .from('teams')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      console.log('❌ 数据库连接失败:', connectionError.message)
      return
    }
    console.log('✅ 数据库连接成功')
    
    // 4. 检查teams表结构
    console.log('\n📊 检查teams表结构...')
    const { data: tableInfo, error: tableError } = await supabase.rpc('get_table_info', { table_name: 'teams' })
    
    if (tableError) {
      console.log('⚠️ 无法获取表结构信息:', tableError.message)
    } else {
      console.log('✅ teams表存在')
    }
    
    // 5. 检查当前用户数量
    console.log('\n👥 检查用户数据...')
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.log('❌ 无法获取用户列表:', usersError.message)
    } else {
      console.log(`✅ 当前用户数量: ${users.users.length}`)
      if (users.users.length > 0) {
        console.log('第一个用户ID:', users.users[0].id)
      }
    }
    
    // 6. 检查RLS策略
    console.log('\n🔒 检查RLS策略...')
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies', { schema_name: 'public', table_name: 'teams' })
    
    if (policiesError) {
      console.log('⚠️ 无法获取RLS策略:', policiesError.message)
    } else {
      console.log('✅ RLS策略检查完成')
      console.log('策略数量:', policies?.length || 0)
    }
    
    // 7. 模拟完整的团队创建流程（使用第一个用户）
    if (users && users.users.length > 0) {
      console.log('\n🧪 模拟团队创建...')
      const testUserId = users.users[0].id
      const testTeamName = `测试团队_${Date.now()}`
      
      let teamId = null
      
      try {
        // 步骤1: 创建团队
        const { data: newTeam, error: createError } = await supabase
          .from('teams')
          .insert({
            name: testTeamName,
            created_by: testUserId
          })
          .select('id, name')
          .single()
        
        if (createError) {
          console.log('❌ 团队创建失败:', createError.message)
          console.log('错误代码:', createError.code)
          console.log('错误详情:', createError.details)
          return
        }
        
        console.log('✅ 团队创建成功:', newTeam)
        teamId = newTeam.id
        
        // 步骤2: 添加团队成员
        console.log('\n👥 添加团队成员...')
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: newTeam.id,
            user_id: testUserId
          })
        
        if (memberError) {
          console.log('❌ 添加团队成员失败:', memberError.message)
          console.log('错误代码:', memberError.code)
          console.log('错误详情:', memberError.details)
        } else {
          console.log('✅ 团队成员添加成功')
        }
        
      } catch (error) {
        console.log('❌ 团队创建过程中发生异常:', error.message)
      } finally {
        // 清理测试数据
        if (teamId) {
          await supabase.from('team_members').delete().eq('team_id', teamId)
          await supabase.from('teams').delete().eq('id', teamId)
          console.log('🧹 测试数据已清理')
        }
      }
    }
    
  } catch (error) {
    console.log('❌ 调试过程中发生错误:', error.message)
    console.log('错误堆栈:', error.stack)
  }
  
  console.log('\n🏁 调试完成')
}

// 运行调试
debugTeamCreation().catch(console.error)