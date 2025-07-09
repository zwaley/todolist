const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function debugMembers() {
  console.log('=== 调试成员显示问题 ===')
  
  // 检查环境变量
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '已设置' : '未设置')
  console.log('SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '已设置' : '未设置')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n请确保 .env.local 文件中设置了正确的 Supabase 环境变量')
    return
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    console.log('\n=== 1. 检查 team_members 表数据 ===')
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('*')
    
    console.log('Members data:', JSON.stringify(members, null, 2))
    if (membersError) console.log('Members error:', membersError)
    
    console.log('\n=== 2. 检查 users 表数据 ===')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
    
    console.log('Users data:', JSON.stringify(users, null, 2))
    if (usersError) console.log('Users error:', usersError)
    
    console.log('\n=== 3. 检查 user_profiles 表数据 ===')
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('*')
    
    console.log('Profiles data:', JSON.stringify(profiles, null, 2))
    if (profilesError) console.log('Profiles error:', profilesError)
    
    console.log('\n=== 4. 测试原始查询（模拟页面查询） ===')
    if (members && members.length > 0) {
      const teamId = members[0].team_id
      console.log('使用团队ID:', teamId)
      
      // 模拟页面中的新查询逻辑
      const { data: pageMembers, error: pageMembersError } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
      
      console.log('页面查询结果:', JSON.stringify(pageMembers, null, 2))
      if (pageMembersError) console.log('页面查询错误:', pageMembersError)
      
      // 获取用户配置文件和认证用户信息
      const memberUserIds = pageMembers?.map(member => member.user_id) || []
      console.log('成员用户ID列表:', memberUserIds)
      
      if (memberUserIds.length > 0) {
        // 获取用户配置文件
        const { data: userProfiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', memberUserIds)
        
        console.log('用户配置文件查询结果:', JSON.stringify(userProfiles, null, 2))
        if (profilesError) console.log('配置文件查询错误:', profilesError)
        
        // 获取认证用户信息（邮箱）
        const { data: authUsersData, error: authError } = await supabase.auth.admin.listUsers()
        const authUsers = authUsersData?.users?.filter(user => memberUserIds.includes(user.id)) || []
        
        console.log('认证用户查询结果:', JSON.stringify(authUsers.map(u => ({id: u.id, email: u.email})), null, 2))
        if (authError) console.log('认证用户查询错误:', authError)
        
        // 组合数据（模拟新的页面逻辑）
        const membersWithProfiles = pageMembers?.map(member => {
          const profile = userProfiles?.find(p => p.user_id === member.user_id)
          const authUser = authUsers?.find(u => u.id === member.user_id)
          return {
            ...member,
            profile: {
              username: profile?.username || '',
              display_name: profile?.display_name || '',
              avatar_url: profile?.avatar_url || '',
              email: authUser?.email || ''
            }
          }
        }) || []
        
        console.log('\n=== 5. 最终组合结果（页面应该显示的数据） ===')
        console.log(JSON.stringify(membersWithProfiles, null, 2))
      }
    }
    
  } catch (error) {
    console.error('调试过程中出错:', error)
  }
}

debugMembers().catch(console.error)