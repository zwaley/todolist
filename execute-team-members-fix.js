const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

/**
 * 执行team_members表结构修复
 * 解决团队创建功能中的数据库问题
 */
class TeamMembersTableFixer {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${level}: ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async executeSQLFile(filePath) {
    try {
      this.log('INFO', `读取SQL文件: ${filePath}`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // 分割SQL语句（简单的分割，基于分号）
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      this.log('INFO', `找到 ${statements.length} 个SQL语句`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            this.log('INFO', `执行语句 ${i + 1}/${statements.length}`);
            console.log(`SQL: ${statement.substring(0, 100)}...`);
            
            const { data, error } = await this.supabase.rpc('exec_sql', {
              sql_query: statement
            });

            if (error) {
              this.log('ERROR', `语句执行失败`, error);
            } else {
              this.log('SUCCESS', `语句执行成功`);
              if (data) {
                console.log('结果:', data);
              }
            }
          } catch (err) {
            this.log('ERROR', `语句执行异常`, err);
          }
        }
      }
    } catch (error) {
      this.log('ERROR', '执行SQL文件失败', error);
    }
  }

  async checkTableStructure() {
    this.log('INFO', '检查team_members表结构...');
    
    try {
      // 检查表结构
      const { data: columns, error: columnsError } = await this.supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'team_members')
        .eq('table_schema', 'public')
        .order('ordinal_position');

      if (columnsError) {
        this.log('ERROR', '获取表结构失败', columnsError);
        return false;
      }

      this.log('SUCCESS', 'team_members表结构:');
      console.table(columns);

      // 检查joined_at列是否存在
      const hasJoinedAt = columns.some(col => col.column_name === 'joined_at');
      this.log('INFO', `joined_at列存在: ${hasJoinedAt}`);

      return hasJoinedAt;
    } catch (error) {
      this.log('ERROR', '检查表结构时出错', error);
      return false;
    }
  }

  async testTeamCreation() {
    this.log('INFO', '测试团队创建功能...');
    
    try {
      // 创建测试团队
      const testTeamName = `测试团队_${Date.now()}`;
      const { data: team, error: teamError } = await this.supabase
        .from('teams')
        .insert({
          name: testTeamName,
          created_by: '00000000-0000-0000-0000-000000000000' // 测试用户ID
        })
        .select()
        .single();

      if (teamError) {
        this.log('ERROR', '创建测试团队失败', teamError);
        return false;
      }

      this.log('SUCCESS', '测试团队创建成功', team);

      // 测试添加团队成员
      const { data: member, error: memberError } = await this.supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: '00000000-0000-0000-0000-000000000000',
          role: 'owner'
        })
        .select()
        .single();

      if (memberError) {
        this.log('ERROR', '添加团队成员失败', memberError);
        // 清理测试团队
        await this.supabase.from('teams').delete().eq('id', team.id);
        return false;
      }

      this.log('SUCCESS', '测试团队成员添加成功', member);

      // 清理测试数据
      await this.supabase.from('team_members').delete().eq('team_id', team.id);
      await this.supabase.from('teams').delete().eq('id', team.id);
      this.log('INFO', '测试数据已清理');

      return true;
    } catch (error) {
      this.log('ERROR', '测试团队创建时出错', error);
      return false;
    }
  }

  async run() {
    this.log('INFO', '开始修复team_members表结构...');

    // 1. 检查当前表结构
    const hasJoinedAt = await this.checkTableStructure();
    
    if (!hasJoinedAt) {
      this.log('INFO', 'joined_at列不存在，需要执行修复');
      
      // 2. 执行修复SQL
      await this.executeSQLFile('./fix-team-members-table-safe.sql');
      
      // 3. 再次检查表结构
      await this.checkTableStructure();
    } else {
      this.log('INFO', 'joined_at列已存在，跳过修复');
    }

    // 4. 测试团队创建功能
    const testResult = await this.testTeamCreation();
    
    if (testResult) {
      this.log('SUCCESS', '✅ team_members表修复完成，团队创建功能正常');
    } else {
      this.log('ERROR', '❌ 团队创建功能仍有问题，需要进一步诊断');
    }
  }
}

// 运行修复
if (require.main === module) {
  const fixer = new TeamMembersTableFixer();
  fixer.run().catch(console.error);
}

module.exports = TeamMembersTableFixer;