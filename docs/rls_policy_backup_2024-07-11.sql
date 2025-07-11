-- ========== RLS 策略备份（2024-07-11） ==========
-- 本文件包含 teams、team_members、todos 三个表的所有RLS策略
-- 使用方法：如需恢复，先执行所有 DROP，再执行所有 CREATE POLICY

-- ========== 1. DROP（清理）所有相关策略 ==========

-- teams 表
DROP POLICY IF EXISTS "Teams: Authenticated users can create their own teams" ON teams;
DROP POLICY IF EXISTS "Teams: Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Teams: Owners can update their teams" ON teams;
DROP POLICY IF EXISTS "Teams: Owners can delete their teams" ON teams;

-- team_members 表
DROP POLICY IF EXISTS "Team Members: Users can be added" ON team_members;
DROP POLICY IF EXISTS "Team Members: Users can leave their own teams" ON team_members;
DROP POLICY IF EXISTS "Team Members: Owners can manage their team members" ON team_members;
DROP POLICY IF EXISTS "Team Members: Owners can delete their team members" ON team_members;
DROP POLICY IF EXISTS "Team Members: Users can see their own membership record" ON team_members;

-- todos 表
DROP POLICY IF EXISTS "Todos: Users can manage their own todos" ON todos;

-- ========== 2. 恢复所有策略（CREATE POLICY） ==========

-- teams 表
CREATE POLICY "Teams: Authenticated users can create their own teams" ON teams
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teams: Users can view teams they are members of" ON teams
  FOR SELECT
  USING (
    id IN (
      SELECT team_members.team_id
      FROM team_members
      WHERE (team_members.user_id = auth.uid())
    )
  );

CREATE POLICY "Teams: Owners can update their teams" ON teams
  FOR UPDATE
  USING (is_team_owner(id));

CREATE POLICY "Teams: Owners can delete their teams" ON teams
  FOR DELETE
  USING (is_team_owner(id));

-- team_members 表
CREATE POLICY "Team Members: Users can be added" ON team_members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Team Members: Users can leave their own teams" ON team_members
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Team Members: Owners can manage their team members" ON team_members
  FOR UPDATE
  USING (is_team_owner(team_id));

CREATE POLICY "Team Members: Owners can delete their team members" ON team_members
  FOR DELETE
  USING (is_team_owner(team_id));

CREATE POLICY "Team Members: Users can see their own membership record" ON team_members
  FOR SELECT
  USING (user_id = auth.uid());

-- todos 表
CREATE POLICY "Todos: Users can manage their own todos" ON todos
  FOR ALL
  USING (user_id = auth.uid()); 