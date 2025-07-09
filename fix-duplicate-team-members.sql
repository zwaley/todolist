-- 修复 team_members 表中的重复数据问题
-- 解决 "duplicate key value violates unique constraint" 错误

-- 1. 首先查看当前重复数据
SELECT 
    team_id,
    user_id,
    COUNT(*) as duplicate_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM team_members 
GROUP BY team_id, user_id
HAVING COUNT(*) > 1;

-- 2. 删除重复记录，只保留最早创建的记录
-- 使用 ctid (PostgreSQL 的行标识符) 来删除重复项
DELETE FROM team_members 
WHERE ctid NOT IN (
    SELECT MIN(ctid)
    FROM team_members 
    GROUP BY team_id, user_id
);

-- 3. 验证重复数据已清理
SELECT 
    'Duplicate check after cleanup' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT (team_id, user_id)) as unique_combinations
FROM team_members;

-- 4. 确保唯一约束存在
-- 删除可能存在的旧约束
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS unique_team_member;
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_pkey;

-- 5. 添加正确的主键约束（这会自动确保唯一性）
ALTER TABLE team_members ADD CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id);

-- 6. 确保外键约束存在
-- team_id 外键
ALTER TABLE team_members 
DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;

ALTER TABLE team_members 
ADD CONSTRAINT team_members_team_id_fkey 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;

-- user_id 外键
ALTER TABLE team_members 
DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;

ALTER TABLE team_members 
ADD CONSTRAINT team_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. 创建性能优化索引
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_joined_at ON team_members(joined_at);

-- 8. 确保 RLS 策略正确
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can join teams" ON team_members;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON team_members;

-- 创建新的 RLS 策略
CREATE POLICY "Users can join teams" ON team_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can leave teams" ON team_members
    FOR DELETE USING (auth.uid() = user_id);

-- 9. 最终验证
SELECT 
    'Fix completed' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT (team_id, user_id)) as unique_combinations,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT (team_id, user_id)) 
        THEN 'No duplicates found' 
        ELSE 'Duplicates still exist!' 
    END as duplicate_status
FROM team_members;

-- 10. 显示最终表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'team_members' AND table_schema = 'public'
ORDER BY ordinal_position;