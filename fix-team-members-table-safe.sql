-- 修复 team_members 表结构（安全版本，避免RLS递归）
-- 解决 "column 'joined_at' of relation 'team_members' does not exist" 错误

-- 1. 检查当前 team_members 表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'team_members' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 如果 joined_at 列不存在，添加它
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. 确保表有正确的主键和外键约束
-- 检查是否有主键
DO $$
BEGIN
    -- 如果没有主键，添加一个复合主键
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'team_members' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE team_members ADD PRIMARY KEY (team_id, user_id);
    END IF;
END $$;

-- 4. 确保外键约束存在
-- 检查 team_id 外键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'team_members' 
        AND constraint_name = 'team_members_team_id_fkey'
    ) THEN
        ALTER TABLE team_members 
        ADD CONSTRAINT team_members_team_id_fkey 
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 检查 user_id 外键
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'team_members' 
        AND constraint_name = 'team_members_user_id_fkey'
    ) THEN
        ALTER TABLE team_members 
        ADD CONSTRAINT team_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. 为现有记录设置 joined_at 时间戳（如果有的话）
UPDATE team_members 
SET joined_at = NOW() 
WHERE joined_at IS NULL;

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_joined_at ON team_members(joined_at);

-- 7. 启用 RLS（如果尚未启用）
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 8. 创建安全的 RLS 策略（避免递归）
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can join teams" ON team_members;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON team_members;
DROP POLICY IF EXISTS "Team owners can manage members" ON team_members;

-- 创建新的安全 RLS 策略
-- 允许用户加入团队（作为自己）
CREATE POLICY "Users can join teams" ON team_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 允许用户查看团队成员（使用teams表验证权限，避免递归）
CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        auth.uid() = user_id
        OR
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- 允许用户离开团队
CREATE POLICY "Users can leave teams" ON team_members
    FOR DELETE USING (auth.uid() = user_id);

-- 允许团队创建者管理成员
CREATE POLICY "Team owners can manage members" ON team_members
    FOR ALL USING (
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- 9. 验证表结构
SELECT 
    'team_members 表结构修复完成（安全版本）' AS status,
    'joined_at 列已添加' AS joined_at_status,
    '安全 RLS 策略已创建' AS rls_status;

-- 10. 显示最终的表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'team_members' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 11. 显示当前的 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'team_members';