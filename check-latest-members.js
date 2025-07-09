const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkLatestMembers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  console.log('=== 检查最新的 team_members 数据 ===')
  const { data: allMembers } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: false })
  
  console.log('所有成员（按创建时间倒序）:')
  allMembers?.forEach((member, index) => {
    console.log(`${index + 1}. 用户ID: ${member.user_id}, 团队ID: ${member.team_id}, 创建时间: ${member.created_at}`)
  })
  
  // 检查特定团队的成员
  if (allMembers && allMembers.length > 0) {
    const teamId = allMembers[0].team_id
    console.log(`\n=== 团队 ${teamId} 的所有成员 ===`)
    const teamMembers = allMembers.filter(m => m.team_id === teamId)
    teamMembers.forEach((member, index) => {
      console.log(`${index + 1}. 用户ID: ${member.user_id}, 创建时间: ${member.created_at}`)
    })
  }
}

checkLatestMembers().catch(console.error)