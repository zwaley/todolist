// 检查数据库结构脚本
// 用于诊断 team_members 表的问题

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

async function checkDatabaseStructure() {
  console.log('🔍 检查数据库结构...')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ 环境变量配置不完整')
    return
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  try {
    // 1. 检查 team_members 表结构
    console.log('\n📊 检查 team_members 表结构:')
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'team_members' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      })
    
    if (columnsError) {
      console.log('❌ 无法获取表结构:', columnsError.message)
      // 尝试直接查询
      const { data: directQuery, error: directError } = await supabase
        .from('team_members')
        .select('*')
        .limit(1)
      
      if (directError) {
        console.log('❌ 直接查询也失败:', directError.message)
      } else {
        console.log('✅ 表存在，但无法获取结构信息')
        if (directQuery && directQuery.length > 0) {
          console.log('表字段:', Object.keys(directQuery[0]))
        }
      }
    } else {
      console.log('✅ 表结构获取成功:')
      console.table(columns)
    }
    
    // 2. 检查是否有 joined_at 列
    console.log('\n🔍 检查 joined_at 列:')
    const { data: sampleData, error: sampleError } = await supabase
      .from('team_members')
      .select('*')
      .limit(1)
    
    if (sampleError) {
      console.log('❌ 无法查询样本数据:', sampleError.message)
    } else {
      const hasJoinedAt = sampleData.length > 0 && 'joined_at' in sampleData[0]
      console.log(hasJoinedAt ? '✅ joined_at 列存在' : '❌ joined_at 列不存在')
      
      if (sampleData.length > 0) {
        console.log('样本记录字段:', Object.keys(sampleData[0]))
      }
    }
    
    // 3. 检查当前数据
    console.log('\n📋 检查当前 team_members 数据:')
    const { data: allData, error: allDataError } = await supabase
      .from('team_members')
      .select('*')
    
    if (allDataError) {
      console.log('❌ 无法获取数据:', allDataError.message)
    } else {
      console.log(`✅ 当前记录数: ${allData.length}`)
      if (allData.length > 0) {
        console.log('前几条记录:')
        console.table(allData.slice(0, 5))
      }
    }
    
    // 4. 检查约束
    console.log('\n🔒 检查表约束:')
    try {
      // 尝试插入重复数据来测试约束
      const testUserId = 'test-user-id'
      const testTeamId = 'test-team-id'
      
      // 先清理可能的测试数据
      await supabase
        .from('team_members')
        .delete()
        .eq('user_id', testUserId)
      
      // 插入第一条记录
      const { error: firstInsertError } = await supabase
        .from('team_members')
        .insert({ team_id: testTeamId, user_id: testUserId })
      
      if (firstInsertError) {
        console.log('❌ 第一次插入失败:', firstInsertError.message)
      } else {
        console.log('✅ 第一次插入成功')
        
        // 尝试插入重复记录
        const { error: duplicateError } = await supabase
          .from('team_members')
          .insert({ team_id: testTeamId, user_id: testUserId })
        
        if (duplicateError) {
          console.log('✅ 唯一约束正常工作:', duplicateError.message)
        } else {
          console.log('⚠️ 唯一约束可能有问题，允许了重复插入')
        }
        
        // 清理测试数据
        await supabase
          .from('team_members')
          .delete()
          .eq('user_id', testUserId)
      }
    } catch (error) {
      console.log('❌ 约束测试失败:', error.message)
    }
    
  } catch (error) {
    console.log('❌ 检查过程中发生错误:', error.message)
  }
  
  console.log('\n🏁 检查完成')
}

// 运行检查
checkDatabaseStructure().catch(console.error)