-- 安全的邀请功能修复脚本
-- 处理函数返回类型冲突问题
-- 执行前请在 Supabase Dashboard 的 SQL Editor 中运行

-- =====================================================
-- 第一步：清理所有可能冲突的函数
-- =====================================================

-- 删除所有可能存在的旧函数（包括不同参数签名）
DROP FUNCTION IF EXISTS get_user_id_by_email(text) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_email(varchar) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_username(text) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_username(varchar) CASCADE;
DROP FUNCTION IF EXISTS is_user_team_member(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS is_user_team_member(integer, text) CASCADE;
DROP FUNCTION IF EXISTS add_team_member_safe(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS add_team_member_safe(integer, text) CASCADE;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;

-- =====================================================
-- 第二步：创建新的函数
-- =====================================================

-- 1. 通过邮箱查找用户ID
CREATE FUNCTION get_user_id_by_email(email text)
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
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- 2. 通过用户名查找用户ID
CREATE FUNCTION get_user_id_by_username(username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_result text;
BEGIN
    -- 首先尝试从user_profiles表查找（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        SELECT user_id INTO user_id_result
        FROM public.user_profiles
        WHERE public.user_profiles.username = get_user_id_by_username.username
        LIMIT 1;
    END IF;
    
    -- 如果没找到，尝试从auth.users的metadata查找
    IF user_id_result IS NULL THEN
        SELECT id INTO user_id_result
        FROM auth.users
        WHERE raw_user_meta_data->>'username' = get_user_id_by_username.username
        AND email_confirmed_at IS NOT NULL
        LIMIT 1;
    END IF;
    
    RETURN user_id_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- 3. 检查用户是否已是团队成员
CREATE FUNCTION is_user_team_member(p_team_id bigint, p_user_id text)
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
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- =====================================================
-- 第三步：创建user_profiles表（如果不存在）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id bigserial PRIMARY KEY,
    user_id text NOT NULL,
    username text UNIQUE,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    CONSTRAINT fk_user_profiles_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username) WHERE username IS NOT NULL;

-- =====================================================
-- 第四步：设置RLS策略
-- =====================================================

-- 启用RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- 创建新策略
CREATE POLICY "Users can view all profiles" ON public.user_profiles
    FOR SELECT USING (true);  -- 允许查看所有用户资料（用于邀请功能）

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 第五步：创建用户注册触发器
-- =====================================================

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (username) DO NOTHING;  -- 如果用户名冲突，忽略
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 如果插入失败，不影响用户注册
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
-- 第六步：验证安装
-- =====================================================

-- 检查函数是否创建成功
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_name IN (
    'get_user_id_by_email',
    'get_user_id_by_username',
    'is_user_team_member',
    'create_user_profile'
)
AND routine_schema = 'public'
ORDER BY routine_name;

-- 检查表是否创建成功
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'user_profiles'
AND table_schema = 'public';

-- 显示完成消息
SELECT '✅ 邀请功能数据库组件安装完成' AS status;
SELECT '📝 下一步：运行 node verify-invite-fix.js 验证安装' AS next_step;