// 检查数据库表结构的脚本
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
    console.error('读取.env.local文件失败:', error.message)
  }
}

loadEnvFile()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTableStructure() {
  console.log('🔍 检查数据库表结构...')
  
  // 检查team_members表结构
  console.log('\n📋 team_members表结构:')
  const teamMembersQuery = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'team_members' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `
  
  const { data: tmColumns, error: tmError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_name', 'team_members')
    .eq('table_schema', 'public')
    .order('ordinal_position')
  
  if (tmError) {
    console.log('❌ team_members查询失败:', tmError.message)
    // 尝试直接查询表
    console.log('尝试直接查询team_members表...')
    const { data: tmData, error: tmDataError } = await supabase
      .from('team_members')
      .select('*')
      .limit(0)
    
    if (tmDataError) {
      console.log('❌ team_members表不存在或无权限:', tmDataError.message)
    } else {
      console.log('✅ team_members表存在但为空')
    }
  } else {
    console.log('✅ team_members表列信息:')
    tmColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })
  }
  
  // 检查teams表结构
  console.log('\n📋 teams表结构:')
  const { data: tColumns, error: tError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_name', 'teams')
    .eq('table_schema', 'public')
    .order('ordinal_position')
  
  if (tError) {
    console.log('❌ teams查询失败:', tError.message)
    // 尝试直接查询表
    console.log('尝试直接查询teams表...')
    const { data: tData, error: tDataError } = await supabase
      .from('teams')
      .select('*')
      .limit(0)
    
    if (tDataError) {
      console.log('❌ teams表不存在或无权限:', tDataError.message)
    } else {
      console.log('✅ teams表存在但为空')
    }
  } else {
    console.log('✅ teams表列信息:')
    tColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })
  }
  
  // 检查todos表结构
  console.log('\n📋 todos表结构:')
  const { data: todoColumns, error: todoError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_name', 'todos')
    .eq('table_schema', 'public')
    .order('ordinal_position')
  
  if (todoError) {
    console.log('❌ todos查询失败:', todoError.message)
  } else {
    console.log('✅ todos表列信息:')
    todoColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })
  }
}

checkTableStructure().catch(console.error)