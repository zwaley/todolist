-- 修复 base64url 编码错误的 SQL 脚本
-- 执行前请在 Supabase Dashboard 的 SQL Editor 中运行

-- 1. 检查并删除可能存在的问题函数和触发器
-- =====================================================

-- 删除可能使用 base64url 的邀请码生成函数
DROP FUNCTION IF EXISTS generate_invite_code() CASCADE;
DROP FUNCTION IF EXISTS generate_invite_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.generate_invite_code() CASCADE;

-- 删除相关触发器
DROP TRIGGER IF EXISTS teams_invite_code_trigger ON teams;
DROP TRIGGER IF EXISTS generate_invite_code_trigger ON teams;

-- 2. 确保 teams 表结构正确
-- ================================

-- 添加 invite_code 字段（如果不存在）
ALTER TABLE teams ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 删除可能存在的约束和索引
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_invite_code_unique;
DROP INDEX IF EXISTS teams_invite_code_unique;
DROP INDEX IF EXISTS idx_teams_invite_code;

-- 3. 创建新的邀请码生成函数（使用 PostgreSQL 支持的编码）
-- ============================================================

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    code TEXT;
    exists_check INTEGER;
BEGIN
    -- 生成唯一的邀请码，使用 MD5 哈希（PostgreSQL 原生支持）
    LOOP
        -- 使用 MD5 生成 8 位邀请码
        code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
        
        -- 检查是否已存在
        SELECT COUNT(*) INTO exists_check 
        FROM teams 
        WHERE invite_code = code;
        
        -- 如果不存在，退出循环
        IF exists_check = 0 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN code;
END;
$$;

-- 4. 创建触发器函数
-- ===================

CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 只在插入时且 invite_code 为空时生成
    IF TG_OP = 'INSERT' AND (NEW.invite_code IS NULL OR NEW.invite_code = '') THEN
        NEW.invite_code := generate_invite_code();
    END IF;
    
    RETURN NEW;
END;
$$;

-- 5. 创建触发器
-- ==============

CREATE TRIGGER teams_set_invite_code_trigger
    BEFORE INSERT ON teams
    FOR EACH ROW
    EXECUTE FUNCTION set_invite_code();

-- 6. 为现有记录生成邀请码
-- =========================

UPDATE teams 
SET invite_code = generate_invite_code() 
WHERE invite_code IS NULL OR invite_code = '';

-- 7. 添加唯一约束和索引
-- =====================

CREATE UNIQUE INDEX teams_invite_code_unique ON teams(invite_code);

-- 8. 重新启用 RLS 并创建基本策略
-- ================================

-- 确保 RLS 已启用
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（避免冲突）
DROP POLICY IF EXISTS "Users can create teams" ON teams;
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Team creators can update their teams" ON teams;
DROP POLICY IF EXISTS "Users can join teams" ON team_members;
DROP POLICY IF EXISTS "Users can view team members" ON team_members;

-- 创建简化的 RLS 策略
CREATE POLICY "Users can create teams" ON teams
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view teams they are members of" ON teams
    FOR SELECT USING (
        id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Team creators can update their teams" ON teams
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can join teams" ON team_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        user_id = auth.uid() OR 
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- 9. 测试插入（验证修复效果）
-- ============================

-- 注意：这个测试需要有效的用户 ID
-- 请将 'YOUR_USER_ID_HERE' 替换为实际的用户 ID
/*
INSERT INTO teams (name, created_by) 
VALUES ('测试团队_修复验证', 'YOUR_USER_ID_HERE');

-- 检查是否成功生成邀请码
SELECT name, invite_code, created_by 
FROM teams 
WHERE name = '测试团队_修复验证';

-- 清理测试数据
DELETE FROM teams WHERE name = '测试团队_修复验证';
*/

-- 10. 完成信息
-- =============

SELECT 'base64url 编码问题修复完成！' AS status,
       'teams 表邀请码生成已更新为使用 MD5 哈希' AS details,
       'RLS 策略已重新创建' AS policies_status;