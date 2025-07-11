-- 全面修复脚本
-- 目标：确保RLS已启用，并重建所有必要的策略

-- =============================================
-- 1. 检查RLS是否已启用
-- =============================================

-- 检查teams表的RLS状态
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('teams', 'team_members', 'todos')
AND relkind = 'r';

-- =============================================
-- 2. 确保RLS已启用
-- =============================================

-- 为所有相关表启用RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. 清理所有现有策略
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
-- 4. 重建完整的RLS策略
-- =============================================

-- Teams表策略
-- 1. 允许用户查看自己创建的团队
-- 2. 允许用户查看自己是成员的团队
CREATE POLICY "teams_select_policy" ON teams
    FOR SELECT
    USING (
        created_by = auth.uid() OR 
        id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );

-- 允许用户修改自己创建的团队
CREATE POLICY "teams_update_delete_policy" ON teams
    FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Team Members表策略
-- 1. 允许用户查看自己的成员记录
-- 2. 允许用户查看与自己在同一团队的所有成员
CREATE POLICY "team_members_select_policy" ON team_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- 允许团队创建者管理团队成员
CREATE POLICY "team_members_insert_update_delete_policy" ON team_members
    FOR ALL
    USING (
        team_id IN (SELECT id FROM teams WHERE created_by = auth.uid())
    )
    WITH CHECK (
        team_id IN (SELECT id FROM teams WHERE created_by = auth.uid())
    );

-- Todos表策略
-- 允许用户查看自己创建的团队中的todo
-- 允许用户查看自己是成员的团队中的todo
CREATE POLICY "todos_select_policy" ON todos
    FOR SELECT
    USING (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
            UNION
            -- 用户的个人todo（team_id为null）
            SELECT NULL WHERE auth.uid() IS NOT NULL
        )
    );

-- 允许用户修改自己创建的团队中的todo
-- 允许用户修改自己是成员的团队中的todo
-- 允许用户修改自己的个人todo
CREATE POLICY "todos_insert_update_delete_policy" ON todos
    FOR ALL
    USING (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
            UNION
            -- 用户的个人todo（team_id为null）
            SELECT NULL WHERE auth.uid() IS NOT NULL
        )
    )
    WITH CHECK (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
            UNION
            -- 用户的个人todo（team_id为null）
            SELECT NULL WHERE auth.uid() IS NOT NULL
        )
    );

-- =============================================
-- 5. 验证策略是否正确添加
-- =============================================

-- 检查RLS是否已启用
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('teams', 'team_members', 'todos')
AND relkind = 'r';

-- 检查所有策略
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
    RAISE NOTICE '✅ 全面修复完成！';
    RAISE NOTICE '📋 RLS已启用，所有必要的策略已重建。';
    RAISE NOTICE '🔍 请刷新页面并测试所有功能：';
    RAISE NOTICE '   - 添加个人todo';
    RAISE NOTICE '   - 创建新团队';
    RAISE NOTICE '   - 查看已有团队';
    RAISE NOTICE '   - 查看团队成员';
END $$;