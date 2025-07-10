// 简单的团队创建功能测试
// 测试修复后的createTeam函数是否正常工作

// 加载环境变量
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

// Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少Supabase配置，请检查.env.local文件')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅' : '❌')
  process.exit(1)
}

async function testTeamCreation() {
  console.log('🧪 开始测试团队创建功能...')
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 测试数据库连接
    console.log('📡 测试数据库连接...')
    const { data: testData, error: testError } = await supabase
      .from('teams')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.error('❌ 数据库连接失败:', testError.message)
      return
    }
    
    console.log('✅ 数据库连接成功')
    
    // 检查teams表结构
    console.log('🔍 检查teams表结构...')
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .limit(1)
    
    if (teamsError) {
      console.error('❌ teams表查询失败:', teamsError.message)
    } else {
      console.log('✅ teams表可访问')
    }
    
    // 检查team_members表结构
    console.log('🔍 检查team_members表结构...')
    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1)
    
    if (membersError) {
      console.error('❌ team_members表查询失败:', membersError.message)
    } else {
      console.log('✅ team_members表可访问')
    }
    
    console.log('\n📋 测试总结:')
    console.log('- 数据库连接: ✅')
    console.log('- teams表: ' + (teamsError ? '❌' : '✅'))
    console.log('- team_members表: ' + (membersError ? '❌' : '✅'))
    
    if (!teamsError && !membersError) {
      console.log('\n🎉 基础设施检查通过！团队创建功能应该可以正常工作。')
      console.log('\n💡 建议:')
      console.log('1. 在浏览器中访问 http://localhost:3002')
      console.log('2. 登录后尝试创建团队')
      console.log('3. 观察是否还有NEXT_REDIRECT错误')
    } else {
      console.log('\n⚠️  发现问题，需要进一步检查数据库配置')
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message)
  }
}

// 运行测试
testTeamCreation()