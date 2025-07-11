-- 修复teams表的SELECT策略，允许用户查看被邀请加入的团队
-- 问题：当前策略只允许用户查看自己创建的团队，导致被邀请的用户看不到团队
-- 解决方案：修改策略，允许用户查看自己是成员的团队

-- 删除现有的有问题的策略
DROP POLICY IF EXISTS "Users can view their own teams" ON teams;
DROP POLICY IF EXISTS "teams_policy_select" ON teams;

-- 创建新的策略：允许用户查看自己创建的团队和自己是成员的团队
CREATE POLICY "Users can view accessible teams" ON teams
  FOR SELECT USING (
    -- 用户可以查看自己创建的团队
    created_by = auth.uid()
    OR
    -- 用户可以查看自己是成员的团队
    id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

-- 验证策略创建成功
-- 可以通过以下查询验证：
-- SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename = 'teams';