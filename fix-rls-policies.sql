-- 彻底修复RLS策略，解决无限递归问题
-- 这个脚本需要在Supabase Dashboard的SQL编辑器中执行

-- 步骤1: 删除所有可能有问题的策略
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Users can join teams" ON team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON team_members;
DROP POLICY IF EXISTS "Team creator can add themselves as a member" ON team_members;
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Team creators can update their teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON teams;
DROP POLICY IF EXISTS "Team creator can select the team" ON teams;
DROP POLICY IF EXISTS "Users can view their own teams" ON teams;

-- 步骤2: 确保RLS已启用
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 步骤3: 为teams表创建新的策略

-- 允许用户创建团队
CREATE POLICY "Users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 允许用户查看自己创建的团队
CREATE POLICY "Users can view their own teams" ON teams
  FOR SELECT USING (auth.uid() = created_by);

-- 允许团队创建者更新自己的团队
CREATE POLICY "Team creators can update their teams" ON teams
  FOR UPDATE USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- 步骤4: 为team_members表创建新的策略（关键：避免递归）

-- 允许用户加入团队（作为自己）
CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 允许用户查看团队成员（无递归版本）
-- 关键修复：使用teams表而不是team_members表来验证权限
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    -- 用户可以查看自己的成员记录
    auth.uid() = user_id
    OR
    -- 或者用户是团队的创建者（通过teams表验证，避免递归）
    team_id IN (
      SELECT id FROM teams WHERE created_by = auth.uid()
    )
  );

-- 允许用户离开团队（删除自己的成员记录）
CREATE POLICY "Users can leave teams" ON team_members
  FOR DELETE USING (auth.uid() = user_id);

-- 步骤5: 验证策略创建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members')
ORDER BY tablename, policyname;

-- 步骤6: 测试查询（应该不会导致递归）
-- 这些查询应该能正常执行而不会导致无限递归
SELECT 'RLS策略修复完成' AS status;
SELECT COUNT(*) as team_count FROM teams;
SELECT COUNT(*) as member_count FROM team_members;