-- 修复邀请功能的RLS策略问题
-- 当前问题：team_members表的INSERT策略只允许用户添加自己，但邀请功能需要团队创建者添加其他用户

-- 删除有问题的策略
DROP POLICY IF EXISTS "Users can join teams" ON team_members;

-- 创建新的策略，允许团队创建者邀请其他用户
CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (
    -- 用户可以添加自己
    auth.uid() = user_id
    OR
    -- 或者当前用户是团队的创建者（可以邀请其他用户）
    team_id IN (
      SELECT id FROM teams WHERE created_by = auth.uid()
    )
  );

-- 验证策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'team_members' AND policyname = 'Users can join teams';

SELECT '邀请功能RLS策略修复完成' AS status;