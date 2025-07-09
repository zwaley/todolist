-- 添加通过昵称(display_name)查找用户的数据库函数
-- 这个函数将支持邀请功能通过用户昵称来查找用户

-- 删除可能存在的旧函数
DROP FUNCTION IF EXISTS get_user_id_by_display_name(text) CASCADE;

-- 创建通过昵称查找用户ID的函数
CREATE OR REPLACE FUNCTION get_user_id_by_display_name(display_name_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_user_id uuid;
BEGIN
    -- 首先在 user_profiles 表中查找
    SELECT user_id INTO found_user_id
    FROM public.user_profiles
    WHERE display_name = display_name_param
    LIMIT 1;
    
    -- 如果找到了，返回用户ID
    IF found_user_id IS NOT NULL THEN
        RETURN found_user_id;
    END IF;
    
    -- 如果在 user_profiles 中没找到，返回 NULL
    RETURN NULL;
END;
$$;

-- 设置函数权限
GRANT EXECUTE ON FUNCTION get_user_id_by_display_name(text) TO authenticated, anon;

-- 测试函数
SELECT '🔍 测试 get_user_id_by_display_name 函数...' AS status;

-- 显示函数创建成功
SELECT '✅ get_user_id_by_display_name 函数创建完成' AS result;

-- 检查函数是否存在
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'get_user_id_by_display_name'
AND routine_schema = 'public';