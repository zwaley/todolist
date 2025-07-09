const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

/**
 * 执行添加display_name查找函数的脚本
 * 这个脚本将在数据库中创建get_user_id_by_display_name函数
 */
class DisplayNameFunctionCreator {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }

  log(type, message, details = null) {
    const timestamp = new Date().toLocaleTimeString()
    
    if (type === 'ERROR') {
      console.log(`❌ [${timestamp}] ${message}`)
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`)
    } else if (type === 'SUCCESS') {
      console.log(`✅ [${timestamp}] ${message}`)
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`)
    } else {
      console.log(`ℹ️ [${timestamp}] ${message}`)
      if (details) console.log(`   详情: ${JSON.stringify(details, null, 2)}`)
    }
  }

  async createDisplayNameFunction() {
    this.log('INFO', '开始创建 get_user_id_by_display_name 函数...')
    
    const functionSQL = `
      -- 删除可能存在的旧函数
      DROP FUNCTION IF EXISTS get_user_id_by_display_name(text) CASCADE;
      
      -- 创建通过昵称查找用户ID的函数
      CREATE OR REPLACE FUNCTION get_user_id_by_display_name(display_name_param text)
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          found_user_id uuid;
      BEGIN
          -- 首先在 user_profiles 表中查找
          SELECT user_id INTO found_user_id
          FROM public.user_profiles
          WHERE display_name = display_name_param
          LIMIT 1;
          
          -- 如果找到了，返回用户ID
          IF found_user_id IS NOT NULL THEN
              RETURN found_user_id;
          END IF;
          
          -- 如果在 user_profiles 中没找到，返回 NULL
          RETURN NULL;
      END;
      $$;
      
      -- 设置函数权限
      GRANT EXECUTE ON FUNCTION get_user_id_by_display_name(text) TO authenticated, anon;
    `
    
    try {
      const { error } = await this.supabase.rpc('exec_sql', { sql: functionSQL })
      
      if (error) {
        // 如果exec_sql不存在，尝试直接执行
        this.log('INFO', 'exec_sql函数不存在，尝试分步执行...')
        
        // 删除旧函数
        const { error: dropError } = await this.supabase
          .rpc('exec', { 
            sql: 'DROP FUNCTION IF EXISTS get_user_id_by_display_name(text) CASCADE;' 
          })
        
        if (dropError) {
          this.log('WARNING', '删除旧函数时出现警告', dropError)
        }
        
        // 创建新函数 - 使用原始SQL执行
        const createFunctionSQL = `
          CREATE OR REPLACE FUNCTION get_user_id_by_display_name(display_name_param text)
          RETURNS uuid
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
              found_user_id uuid;
          BEGIN
              SELECT user_id INTO found_user_id
              FROM public.user_profiles
              WHERE display_name = display_name_param
              LIMIT 1;
              
              IF found_user_id IS NOT NULL THEN
                  RETURN found_user_id;
              END IF;
              
              RETURN NULL;
          END;
          $$;
        `
        
        // 由于Supabase限制，我们需要手动创建函数
        this.log('INFO', '由于Supabase限制，函数需要在数据库管理界面手动创建')
        this.log('INFO', '请复制以下SQL到Supabase SQL编辑器中执行:')
        console.log('\n=== SQL代码开始 ===')
        console.log(createFunctionSQL)
        console.log('=== SQL代码结束 ===\n')
        
        return false
      } else {
        this.log('SUCCESS', 'get_user_id_by_display_name 函数创建成功')
        return true
      }
    } catch (err) {
      this.log('ERROR', '创建函数时发生异常', err.message)
      return false
    }
  }

  async testFunction() {
    this.log('INFO', '测试 get_user_id_by_display_name 函数...')
    
    try {
      // 测试函数调用
      const { data, error } = await this.supabase
        .rpc('get_user_id_by_display_name', { display_name_param: 'Test User' })
      
      if (error) {
        this.log('ERROR', '函数测试失败', error)
        return false
      } else {
        this.log('SUCCESS', '函数测试成功', { result: data })
        return true
      }
    } catch (err) {
      this.log('ERROR', '函数测试异常', err.message)
      return false
    }
  }

  async checkExistingFunction() {
    this.log('INFO', '检查现有函数...')
    
    try {
      const { data, error } = await this.supabase
        .from('information_schema.routines')
        .select('routine_name, routine_type')
        .eq('routine_name', 'get_user_id_by_display_name')
        .eq('routine_schema', 'public')
      
      if (error) {
        this.log('ERROR', '检查函数失败', error)
        return false
      }
      
      if (data && data.length > 0) {
        this.log('SUCCESS', '函数已存在', data)
        return true
      } else {
        this.log('INFO', '函数不存在，需要创建')
        return false
      }
    } catch (err) {
      this.log('ERROR', '检查函数异常', err.message)
      return false
    }
  }

  async execute() {
    console.log('=== 添加 display_name 查找函数 ===\n')
    
    try {
      // 检查函数是否已存在
      const exists = await this.checkExistingFunction()
      
      if (!exists) {
        // 创建函数
        const created = await this.createDisplayNameFunction()
        
        if (created) {
          // 测试函数
          await this.testFunction()
        }
      } else {
        this.log('INFO', '函数已存在，跳过创建')
        // 测试现有函数
        await this.testFunction()
      }
      
      this.log('SUCCESS', '脚本执行完成')
    } catch (err) {
      this.log('ERROR', '脚本执行失败', err.message)
    }
  }
}

// 执行脚本
if (require.main === module) {
  const creator = new DisplayNameFunctionCreator()
  creator.execute()
}

module.exports = DisplayNameFunctionCreator