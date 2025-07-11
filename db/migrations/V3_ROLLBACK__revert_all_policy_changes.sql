-- 紧急回退脚本
-- 目标：撤销所有最近的RLS策略变更，恢复到最基本、最稳定的状态
-- 执行此脚本将删除所有在teams, team_members, todos表上的策略，然后重建最核心的策略

-- =============================================
-- 1. 清理所有相关表的RLS策略
-- =============================================

-- 清理 teams 表策略
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'teams')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON teams;';
    END LOOP;
END $$;

-- 清理 team_members 表策略
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON team_members;';
    END LOOP;
END $$;

-- 清理 todos 表策略
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'todos')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON todos;';
    END LOOP;
END $$;

-- =============================================
-- 2. 重建最基本、最稳定的RLS策略
-- =============================================

-- Teams表：用户只能操作自己创建的团队
CREATE POLICY "teams_owner_all_access" ON teams
    FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Team Members表：用户只能看到自己的成员记录
CREATE POLICY "team_members_self_select" ON team_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Todos表：用户只能操作自己创建的团队中的todo
CREATE POLICY "todos_owner_all_access" ON todos
    FOR ALL
    USING (team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()))
    WITH CHECK (team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()));

-- =============================================
-- 3. 验证回退结果
-- =============================================

-- 检查策略是否已恢复到基本状态
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members', 'todos')
ORDER BY tablename, policyname;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 紧急回退完成！';
    RAISE NOTICE '📋 RLS策略已恢复到最基本、最稳定的状态。';
    RAISE NOTICE '🔧 现在创建团队、新增个人todo的功能应该已恢复。';
    RAISE NOTICE '⚠️ 注意：团队邀请和成员可见性功能将暂时不可用，直到问题被正确修复。';
END $$;