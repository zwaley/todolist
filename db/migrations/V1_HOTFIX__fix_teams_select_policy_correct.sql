-- 紧急修复：teams表SELECT策略
-- 问题：执行V1迁移后，创建者无法看到自己创建的团队
-- 原因：策略逻辑可能有问题或者策略被意外删除

-- 首先检查当前策略状态
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'teams'
ORDER BY policyname;

-- 删除所有可能存在的teams表SELECT策略（确保清理干净）
DROP POLICY IF EXISTS "Users can view their own teams" ON teams;
DROP POLICY IF EXISTS "teams_policy_select" ON teams;
DROP POLICY IF EXISTS "teams_select_policy" ON teams;
DROP POLICY IF EXISTS "teams_select" ON teams;

-- 创建正确的SELECT策略
-- 注意：使用OR逻辑，确保用户能看到：
-- 1. 自己创建的团队 (created_by = auth.uid())
-- 2. 自己是成员的团队 (通过team_members表关联)
CREATE POLICY "teams_select_policy" ON teams
    FOR SELECT
    USING (
        -- 用户是团队创建者
        created_by = auth.uid() 
        OR 
        -- 用户是团队成员（任何状态）
        id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        )
    );

-- 验证策略创建成功
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'teams' AND cmd = 'SELECT';

-- 测试查询：验证当前用户能看到的团队
-- 这个查询应该返回用户创建的团队和被邀请加入的团队
SELECT 
    t.id,
    t.name,
    t.description,
    t.created_by,
    CASE 
        WHEN t.created_by = auth.uid() THEN 'owner'
        ELSE 'member'
    END as role,
    tm.status as member_status
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = auth.uid()
ORDER BY t.created_at DESC;

-- 如果上面的查询仍然没有返回结果，执行以下诊断查询：

-- 1. 检查当前用户ID
SELECT auth.uid() as current_user_id;

-- 2. 检查teams表中是否有数据
SELECT COUNT(*) as total_teams FROM teams;

-- 3. 检查当前用户创建的团队（绕过RLS）
SELECT COUNT(*) as user_created_teams 
FROM teams 
WHERE created_by = auth.uid();

-- 4. 检查team_members表中当前用户的记录
SELECT COUNT(*) as user_memberships 
FROM team_members 
WHERE user_id = auth.uid();

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '🔧 teams表SELECT策略已重新创建';
    RAISE NOTICE '📋 请执行上面的测试查询验证结果';
    RAISE NOTICE '⚠️ 如果仍有问题，请检查诊断查询的结果';
END $$;