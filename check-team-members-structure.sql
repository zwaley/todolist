-- 检查 team_members 表的当前结构和数据状态
-- 用于诊断团队创建功能问题

-- 1. 检查 team_members 表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'team_members' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查表约束
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'team_members' AND table_schema = 'public';

-- 3. 检查唯一约束详情
SELECT 
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'team_members' 
    AND tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public';

-- 4. 检查当前数据
SELECT 
    team_id,
    user_id,
    joined_at,
    COUNT(*) as count
FROM team_members 
GROUP BY team_id, user_id, joined_at
HAVING COUNT(*) > 1;

-- 5. 检查是否存在 joined_at 列
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'team_members' 
            AND column_name = 'joined_at'
            AND table_schema = 'public'
        ) THEN 'joined_at 列存在'
        ELSE 'joined_at 列不存在'
    END as joined_at_status;

-- 6. 显示所有 team_members 记录
SELECT * FROM team_members ORDER BY team_id, user_id;