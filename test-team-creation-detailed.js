// 详细的团队创建测试脚本
// 用于诊断团队创建失败的具体原因

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 手动读取.env.local文件
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env.local')
    const envContent = fs.readFileSync(envPath, 'utf8')
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    })
  } catch (error) {
    console.error('读取.env.local文件失败:', error.message)
  }
}

// 加载环境变量
loadEnvFile()

async function testTeamCreationDetailed() {
  console.log('🔍 详细测试团队创建流程...')
  
  // 检查环境变量
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ 环境变量配置不完整')
    return
  }
  
  // 创建Supabase客户端（使用service role key以绕过RLS）
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  // 创建普通客户端（受RLS限制）
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  const testTeamName = `测试团队_${Date.now()}`
  let testTeamId = null
  let testUserId = null
  
  try {
    // 1. 获取一个测试用户ID
    console.log('\n📋 步骤1: 获取测试用户...')
    
    // 先尝试从auth.users获取
    const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authUsersError || !authUsers || authUsers.users.length === 0) {
      console.log('❌ 无法获取认证用户:', authUsersError)
      // 如果没有用户，创建一个测试用户ID
      testUserId = '00000000-0000-0000-0000-000000000001'
      console.log('⚠️  使用模拟用户ID:', testUserId)
    } else {
      testUserId = authUsers.users[0].id
      console.log('✅ 测试用户ID:', testUserId)
    }
    
    // 2. 测试创建团队（使用admin权限）
    console.log('\n📋 步骤2: 测试创建团队记录...')
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .insert({
        name: testTeamName,
        created_by: testUserId
      })
      .select()
      .single()
    
    if (teamError) {
      console.log('❌ 创建团队失败:', teamError)
      return
    }
    
    testTeamId = team.id
    console.log('✅ 团队创建成功:', { id: team.id, name: team.name })
    
    // 3. 测试添加团队成员（使用admin权限）
    console.log('\n📋 步骤3: 测试添加团队成员（admin权限）...')
    const { error: memberErrorAdmin } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id: testTeamId,
        user_id: testUserId,
        role: 'owner'
      })
    
    if (memberErrorAdmin) {
      console.log('❌ 添加团队成员失败（admin权限）:', memberErrorAdmin)
    } else {
      console.log('✅ 添加团队成员成功（admin权限）')
    }
    
    // 4. 测试添加团队成员（使用普通用户权限，模拟实际情况）
    console.log('\n📋 步骤4: 测试添加团队成员（普通用户权限）...')
    
    // 先删除之前的记录
    await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('team_id', testTeamId)
      .eq('user_id', testUserId)
    
    // 模拟用户认证
    const { error: memberErrorUser } = await supabaseUser
      .from('team_members')
      .insert({
        team_id: testTeamId,
        user_id: testUserId,
        role: 'owner'
      })
    
    if (memberErrorUser) {
      console.log('❌ 添加团队成员失败（普通用户权限）:', memberErrorUser)
      console.log('   这可能是RLS策略问题！')
    } else {
      console.log('✅ 添加团队成员成功（普通用户权限）')
    }
    
    // 5. 检查当前的RLS策略
    console.log('\n📋 步骤5: 检查team_members表的RLS策略...')
    const { data: policies, error: policiesError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT 
            tablename,
            policyname,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE tablename = 'team_members'
          ORDER BY policyname;
        `
      })
    
    if (policiesError) {
      console.log('❌ 获取RLS策略失败:', policiesError)
    } else {
      console.log('📋 当前team_members表的RLS策略:')
      if (policies && policies.length > 0) {
        policies.forEach(policy => {
          console.log(`  - ${policy.policyname} (${policy.cmd})`)
          console.log(`    条件: ${policy.qual}`)
        })
      } else {
        console.log('  没有找到RLS策略')
      }
    }
    
    // 6. 检查teams表的RLS策略
    console.log('\n📋 步骤6: 检查teams表的RLS策略...')
    const { data: teamPolicies, error: teamPoliciesError } = await supabaseAdmin
      .rpc('exec_sql', {
        sql: `
          SELECT 
            tablename,
            policyname,
            cmd,
            qual,
            with_check
          FROM pg_policies 
          WHERE tablename = 'teams'
          ORDER BY policyname;
        `
      })
    
    if (teamPoliciesError) {
      console.log('❌ 获取teams表RLS策略失败:', teamPoliciesError)
    } else {
      console.log('📋 当前teams表的RLS策略:')
      if (teamPolicies && teamPolicies.length > 0) {
        teamPolicies.forEach(policy => {
          console.log(`  - ${policy.policyname} (${policy.cmd})`)
          console.log(`    条件: ${policy.qual}`)
        })
      } else {
        console.log('  没有找到RLS策略')
      }
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  } finally {
    // 清理测试数据
    if (testTeamId) {
      console.log('\n🧹 清理测试数据...')
      await supabaseAdmin.from('team_members').delete().eq('team_id', testTeamId)
      await supabaseAdmin.from('teams').delete().eq('id', testTeamId)
      console.log('✅ 测试数据已清理')
    }
  }
}

// 运行测试
testTeamCreationDetailed().catch(console.error)