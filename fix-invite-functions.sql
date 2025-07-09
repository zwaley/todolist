-- 修复邀请功能：创建缺失的数据库函数
-- 执行前请在 Supabase Dashboard 的 SQL Editor 中运行

-- =====================================================
-- 1. 创建通过邮箱查找用户ID的函数
-- =====================================================

-- 先删除可能存在的旧函数（避免返回类型冲突）
DROP FUNCTION IF EXISTS get_user_id_by_email(text);
DROP FUNCTION IF EXISTS get_user_id_by_username(text);
DROP FUNCTION IF EXISTS is_user_team_member(bigint, text);
DROP FUNCTION IF EXISTS add_team_member_safe(bigint, text);
DROP FUNCTION IF EXISTS create_user_profile();

CREATE OR REPLACE FUNCTION get_user_id_by_email(email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_result text;
BEGIN
    -- 从auth.users表中查找用户
    SELECT id INTO user_id_result
    FROM auth.users
    WHERE auth.users.email = get_user_id_by_email.email
    AND email_confirmed_at IS NOT NULL  -- 确保邮箱已验证
    LIMIT 1;
    
    RETURN user_id_result;
END;
$$;

-- =====================================================
-- 2. 创建通过用户名查找用户ID的函数
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_id_by_username(username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_result text;
BEGIN
    -- 从user_profiles表中查找用户（如果存在该表）
    -- 如果没有user_profiles表，则从auth.users的raw_user_meta_data中查找
    
    -- 首先尝试从user_profiles表查找
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        SELECT user_id INTO user_id_result
        FROM user_profiles
        WHERE user_profiles.username = get_user_id_by_username.username
        LIMIT 1;
    END IF;
    
    -- 如果user_profiles表不存在或没找到，尝试从auth.users的metadata查找
    IF user_id_result IS NULL THEN
        SELECT id INTO user_id_result
        FROM auth.users
        WHERE raw_user_meta_data->>'username' = get_user_id_by_username.username
        AND email_confirmed_at IS NOT NULL  -- 确保用户已验证
        LIMIT 1;
    END IF;
    
    RETURN user_id_result;
END;
$$;

-- =====================================================
-- 3. 创建检查用户是否已是团队成员的函数
-- =====================================================

CREATE OR REPLACE FUNCTION is_user_team_member(p_team_id bigint, p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    member_exists boolean := false;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id AND user_id = p_user_id
    ) INTO member_exists;
    
    RETURN member_exists;
END;
$$;

-- =====================================================
-- 4. 创建安全的添加团队成员函数
-- =====================================================

CREATE OR REPLACE FUNCTION add_team_member_safe(p_team_id bigint, p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    team_exists boolean := false;
    user_exists boolean := false;
    already_member boolean := false;
BEGIN
    -- 检查团队是否存在
    SELECT EXISTS(SELECT 1 FROM teams WHERE id = p_team_id) INTO team_exists;
    IF NOT team_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'TEAM_NOT_FOUND',
            'message', '团队不存在'
        );
    END IF;
    
    -- 检查用户是否存在
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO user_exists;
    IF NOT user_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', '用户不存在'
        );
    END IF;
    
    -- 检查用户是否已是团队成员
    SELECT is_user_team_member(p_team_id, p_user_id) INTO already_member;
    IF already_member THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_MEMBER',
            'message', '用户已是团队成员'
        );
    END IF;
    
    -- 添加用户到团队
    INSERT INTO team_members (team_id, user_id, joined_at)
    VALUES (p_team_id, p_user_id, NOW());
    
    RETURN json_build_object(
        'success', true,
        'message', '成功添加到团队'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', '数据库操作失败: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- 5. 创建user_profiles表（如果不存在）
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id bigserial PRIMARY KEY,
    user_id text REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

-- 为user_profiles表创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 为user_profiles表启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 创建user_profiles的RLS策略
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view all profiles" ON user_profiles
    FOR SELECT USING (true);  -- 允许查看所有用户资料（用于邀请功能）

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. 创建用户注册时自动创建profile的触发器
-- =====================================================

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_profiles (user_id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 如果插入失败（比如用户名冲突），忽略错误
        RETURN NEW;
END;
$$;

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;

-- 创建新触发器
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- =====================================================
-- 7. 验证函数创建
-- =====================================================

-- 检查函数是否创建成功
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name IN (
    'get_user_id_by_email',
    'get_user_id_by_username',
    'is_user_team_member',
    'add_team_member_safe',
    'create_user_profile'
)
ORDER BY routine_name;

-- 检查表是否创建成功
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'user_profiles';

SELECT '邀请功能数据库函数创建完成' AS status;