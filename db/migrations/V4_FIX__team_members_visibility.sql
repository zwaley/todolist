-- 修复团队成员可见性问题
-- 目标：允许用户查看自己所在团队的所有成员

-- =============================================
-- 1. 检查当前team_members表的策略状态
-- =============================================

SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'team_members'
ORDER BY policyname;

-- =============================================
-- 2. 添加允许查看同一团队所有成员的策略
-- =============================================

-- 删除现有的可能冲突的策略
DROP POLICY IF EXISTS "team_members_same_team_select" ON team_members;

-- 创建新策略：允许用户查看与自己在同一团队的所有成员
CREATE POLICY "team_members_same_team_select" ON team_members
    FOR SELECT
    USING (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- =============================================
-- 3. 验证策略是否正确添加
-- =============================================

-- 检查策略是否已添加
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'team_members'
ORDER BY policyname;

-- =============================================
-- 4. 诊断查询（如果需要）
-- =============================================

-- 查询当前用户所在的所有团队
-- 替换 'your-user-id' 为实际的用户ID进行测试
-- SELECT * FROM teams WHERE id IN (SELECT team_id FROM team_members WHERE user_id = 'your-user-id');

-- 查询特定团队的所有成员
-- 替换 'team-id' 为实际的团队ID进行测试
-- SELECT * FROM team_members WHERE team_id = 'team-id';

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ 团队成员可见性修复完成！';
    RAISE NOTICE '📋 现在用户应该可以看到自己所在团队的所有成员。';
    RAISE NOTICE '🔍 请刷新页面并检查团队成员列表是否正确显示。';
END $$;