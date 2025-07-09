-- 修复 team_members 表的 RLS 策略无限递归问题
-- 解决 "infinite recursion detected in policy for relation 'team_members'" 错误

-- 1. 删除有问题的策略
DROP POLICY IF EXISTS "Users can view team members" ON team_members;

-- 2. 创建修复后的策略，避免递归查询
-- 方案1：使用 teams 表来验证用户权限，而不是 team_members 表
CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        -- 检查用户是否是团队创建者
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
        OR
        -- 或者直接检查当前记录是否属于当前用户
        user_id = auth.uid()
    );

-- 3. 验证策略是否正确创建
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
WHERE tablename = 'team_members';

-- 4. 测试策略（可选）
-- 这个查询应该不会导致无限递归
-- SELECT * FROM team_members LIMIT 1;