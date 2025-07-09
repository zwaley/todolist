// 检查当前数据库中的RLS策略
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

async function checkCurrentRLSPolicies() {
  console.log('🔍 检查当前数据库RLS策略...')
  
  // 检查环境变量
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ 环境变量配置不完整')
    return
  }
  
  // 创建Supabase客户端（使用service role key）
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    console.log('\n📋 查询teams表的RLS策略...')
    const { data: teamsPolicies, error: teamsError } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'teams')
    
    if (teamsError) {
      console.log('❌ 查询teams表策略失败:', teamsError)
    } else {
      console.log('✅ teams表当前策略:')
      if (teamsPolicies && teamsPolicies.length > 0) {
        teamsPolicies.forEach(policy => {
          console.log(`  - ${policy.policyname} (${policy.cmd})`)
          console.log(`    条件: ${policy.qual || policy.with_check || 'N/A'}`)
        })
      } else {
        console.log('  ⚠️  没有找到teams表的RLS策略')
      }
    }
    
    console.log('\n📋 查询team_members表的RLS策略...')
    const { data: membersPolicies, error: membersError } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'team_members')
    
    if (membersError) {
      console.log('❌ 查询team_members表策略失败:', membersError)
    } else {
      console.log('✅ team_members表当前策略:')
      if (membersPolicies && membersPolicies.length > 0) {
        membersPolicies.forEach(policy => {
          console.log(`  - ${policy.policyname} (${policy.cmd})`)
          console.log(`    条件: ${policy.qual || policy.with_check || 'N/A'}`)
        })
      } else {
        console.log('  ⚠️  没有找到team_members表的RLS策略')
      }
    }
    
    console.log('\n📋 检查RLS是否启用...')
    // 跳过RLS状态检查，因为exec_sql函数不存在
    console.log('⚠️  跳过RLS状态检查（exec_sql函数不存在）')
    
    console.log('\n📋 测试用户认证状态...')
    // 创建普通客户端测试认证
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    
    if (userError || !user) {
      console.log('❌ 当前没有认证用户')
      console.log('   这可能是团队创建失败的原因之一')
    } else {
      console.log('✅ 当前认证用户:', user.id)
      
      // 测试创建团队权限
      console.log('\n📋 测试创建团队权限...')
      const testTeamName = `权限测试_${Date.now()}`
      const { data: testTeam, error: testTeamError } = await supabaseUser
        .from('teams')
        .insert({
          name: testTeamName,
          created_by: user.id
        })
        .select()
        .single()
      
      if (testTeamError) {
        console.log('❌ 创建团队权限测试失败:', testTeamError)
        console.log('   这就是团队创建失败的原因！')
      } else {
        console.log('✅ 创建团队权限测试成功')
        
        // 测试添加团队成员权限
        console.log('\n📋 测试添加团队成员权限...')
        const { error: testMemberError } = await supabaseUser
          .from('team_members')
          .insert({
            team_id: testTeam.id,
            user_id: user.id,
            role: 'owner'
          })
        
        if (testMemberError) {
          console.log('❌ 添加团队成员权限测试失败:', testMemberError)
          console.log('   这就是添加成员失败的原因！')
        } else {
          console.log('✅ 添加团队成员权限测试成功')
        }
        
        // 清理测试数据
        await supabaseAdmin.from('team_members').delete().eq('team_id', testTeam.id)
        await supabaseAdmin.from('teams').delete().eq('id', testTeam.id)
        console.log('🧹 测试数据已清理')
      }
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error)
  }
}

// 运行检查
checkCurrentRLSPolicies().catch(console.error)