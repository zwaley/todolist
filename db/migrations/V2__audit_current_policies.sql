-- V2: 审计并记录当前数据库RLS策略状态
-- 目的：建立策略基线，确保所有策略变更都有记录
-- 执行日期：待定
-- 执行前请先备份当前策略状态

-- ============================================
-- 第一步：记录当前策略状态（仅查询，不修改）
-- ============================================

-- 查询当前所有RLS策略（执行前请运行此查询并保存结果）
/*
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members', 'todos')
ORDER BY tablename, cmd, policyname;
*/

-- ============================================
-- 第二步：清理重复策略
-- ============================================

-- teams表有两个相同的SELECT策略，保留语义更清晰的那个
DROP POLICY IF EXISTS "teams_policy_select" ON teams;
-- 保留 "Users can view their own teams" (将在V1中修改)

-- teams表有两个相同的UPDATE策略，保留语义更清晰的那个  
DROP POLICY IF EXISTS "teams_policy_update" ON teams;
-- 保留 "Team creators can update their teams"

-- ============================================
-- 第三步：标准化策略命名
-- ============================================

-- 重命名不规范的策略名称
ALTER POLICY "teams_policy_delete" ON teams RENAME TO "Team creators can delete their teams";
ALTER POLICY "teams_policy_insert" ON teams RENAME TO "Users can create teams";

-- ============================================
-- 第四步：验证策略状态
-- ============================================

-- 验证清理后的策略（执行后请运行此查询验证结果）
/*
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members', 'todos')
ORDER BY tablename, cmd, policyname;

预期结果：
teams表应该有以下策略：
- "Users can view their own teams" (SELECT) - 待V1修改
- "Users can create teams" (INSERT)
- "Team creators can update their teams" (UPDATE) 
- "Team creators can delete their teams" (DELETE)

team_members表应该有以下策略：
- "Users can view team members" (SELECT)
- "Users can join teams" (INSERT)
- "Users can leave teams" (DELETE)
- "Team owners can manage members" (ALL)
*/

-- ============================================
-- 回退说明
-- ============================================
/*
ROLLBACK INSTRUCTIONS:
如果需要回退此迁移：

1. 恢复删除的策略：
CREATE POLICY "teams_policy_select" ON teams
  FOR SELECT USING (created_by = auth.uid());
  
CREATE POLICY "teams_policy_update" ON teams
  FOR UPDATE USING (created_by = auth.uid());

2. 恢复原策略名称：
ALTER POLICY "Team creators can delete their teams" ON teams RENAME TO "teams_policy_delete";
ALTER POLICY "Users can create teams" ON teams RENAME TO "teams_policy_insert";
*/

-- ============================================
-- 执行日志模板
-- ============================================
/*
执行日期：
执行人：
执行环境：[开发/测试/生产]
执行结果：[成功/失败]
备注：
*/