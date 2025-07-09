-- 完整的邀请功能数据库修复脚本
-- 包含所有必需的函数和表结构

-- =====================================================
-- 1. 删除可能存在的旧函数（避免冲突）
-- =====================================================

DROP FUNCTION IF EXISTS get_user_id_by_email(text) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_username(text) CASCADE;
DROP FUNCTION IF EXISTS is_user_team_member(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS is_user_team_member(integer, text) CASCADE;
DROP FUNCTION IF EXISTS add_team_member_safe(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS add_team_member_safe(integer, text) CASCADE;
DROP FUNCTION IF EXISTS create_user_profile(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;

-- =====================================================
-- 2. 创建 user_profiles 表（如果不存在）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id bigserial PRIMARY KEY,
    user_id text NOT NULL,
    username text UNIQUE,
    display_name text,
    avatar_url text,
    bio text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    CONSTRAINT fk_user_profiles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username) WHERE username IS NOT NULL;

-- =====================================================
-- 3. 设置 user_profiles 表的 RLS 策略
-- =====================================================

-- 启用RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;

-- 创建新策略
CREATE POLICY "Users can view all profiles" ON public.user_profiles
    FOR SELECT USING (true);  -- 允许查看所有用户资料（用于邀请功能）

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 服务角色可以管理所有资料（用于邀请功能）
CREATE POLICY "Service role can manage profiles" ON public.user_profiles
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 4. 创建核心函数
-- =====================================================

-- 4.1 通过邮箱获取用户ID
CREATE OR REPLACE FUNCTION get_user_id_by_email(email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_result text;
BEGIN
    -- 首先从 auth.users 表查找
    SELECT id INTO user_id_result
    FROM auth.users
    WHERE auth.users.email = get_user_id_by_email.email
    LIMIT 1;
    
    RETURN user_id_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- 4.2 通过用户名获取用户ID
CREATE OR REPLACE FUNCTION get_user_id_by_username(username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_result text;
BEGIN
    -- 从 user_profiles 表查找
    SELECT user_id INTO user_id_result
    FROM public.user_profiles
    WHERE user_profiles.username = get_user_id_by_username.username
    LIMIT 1;
    
    RETURN user_id_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- 4.3 检查用户是否为团队成员
CREATE OR REPLACE FUNCTION is_user_team_member(team_id bigint, user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    member_exists boolean := false;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.team_members
        WHERE team_members.team_id = is_user_team_member.team_id 
        AND team_members.user_id = is_user_team_member.user_id
    ) INTO member_exists;
    
    RETURN member_exists;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- 4.4 安全地添加团队成员
CREATE OR REPLACE FUNCTION add_team_member_safe(team_id bigint, user_id text)
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
    SELECT EXISTS(
        SELECT 1 FROM public.teams WHERE id = add_team_member_safe.team_id
    ) INTO team_exists;
    
    IF NOT team_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'TEAM_NOT_FOUND',
            'message', '团队不存在'
        );
    END IF;
    
    -- 检查用户是否存在
    SELECT EXISTS(
        SELECT 1 FROM auth.users WHERE id = add_team_member_safe.user_id
    ) INTO user_exists;
    
    IF NOT user_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', '用户不存在'
        );
    END IF;
    
    -- 检查是否已经是成员
    SELECT is_user_team_member(add_team_member_safe.team_id, add_team_member_safe.user_id) INTO already_member;
    
    IF already_member THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_MEMBER',
            'message', '用户已经是团队成员'
        );
    END IF;
    
    -- 添加团队成员
    INSERT INTO public.team_members (team_id, user_id, role, joined_at)
    VALUES (add_team_member_safe.team_id, add_team_member_safe.user_id, 'member', NOW());
    
    RETURN json_build_object(
        'success', true,
        'message', '成功添加团队成员'
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

-- 4.5 创建用户资料（手动调用版本）
CREATE OR REPLACE FUNCTION create_user_profile(user_id text, username text, display_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- 尝试插入用户资料
    INSERT INTO public.user_profiles (user_id, username, display_name)
    VALUES (create_user_profile.user_id, create_user_profile.username, create_user_profile.display_name)
    ON CONFLICT (username) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        updated_at = NOW();
    
    RETURN json_build_object(
        'success', true,
        'message', '用户资料创建/更新成功'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', '创建用户资料失败: ' || SQLERRM
        );
END;
$$;

-- =====================================================
-- 5. 创建用户注册触发器函数
-- =====================================================

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    username_value text;
    display_name_value text;
BEGIN
    -- 从元数据或邮箱生成用户名和显示名
    username_value := COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email, '@', 1)
    );
    
    display_name_value := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
    );
    
    -- 确保用户名唯一
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE username = username_value) THEN
        username_value := username_value || '_' || substr(NEW.id, 1, 8);
    END IF;
    
    -- 插入用户资料
    INSERT INTO public.user_profiles (user_id, username, display_name)
    VALUES (NEW.id, username_value, display_name_value);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 如果插入失败，不影响用户注册
        RETURN NEW;
END;
$$;

-- 创建触发器
CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 6. 设置函数权限
-- =====================================================

-- 授予必要的权限
GRANT EXECUTE ON FUNCTION get_user_id_by_email(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_id_by_username(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_user_team_member(bigint, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_team_member_safe(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(text, text, text) TO authenticated;

-- =====================================================
-- 7. 验证安装
-- =====================================================

-- 测试函数
SELECT '🔍 测试 get_user_id_by_email 函数...' AS status;
SELECT get_user_id_by_email('test@example.com') AS test_result;

SELECT '🔍 测试 get_user_id_by_username 函数...' AS status;
SELECT get_user_id_by_username('testuser') AS test_result;

SELECT '🔍 测试 is_user_team_member 函数...' AS status;
SELECT is_user_team_member(1, 'test-user-id') AS test_result;

-- 检查表
SELECT '📊 检查 user_profiles 表...' AS status;
SELECT COUNT(*) AS profile_count FROM public.user_profiles;

SELECT '📊 检查 teams 表...' AS status;
SELECT COUNT(*) AS team_count FROM public.teams;

SELECT '📊 检查 team_members 表...' AS status;
SELECT COUNT(*) AS member_count FROM public.team_members;

-- 显示完成消息
SELECT '✅ 邀请功能数据库组件安装完成！' AS status;
SELECT '📝 下一步：运行 node debug-invite-errors.js 验证' AS next_step;
SELECT '🎯 然后运行 node verify-functions-only.js 进行最终检查' AS final_step;