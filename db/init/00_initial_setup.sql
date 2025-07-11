-- TodoList 数据库初始化脚本
-- 创建所有必要的表、策略和函数
-- 基于实际数据库状态同步更新

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建 teams 表
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 100),
    description TEXT CHECK (length(description) <= 500),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    invite_code TEXT
);

-- 创建 team_members 表
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (team_id, user_id),
    CONSTRAINT unique_team_member UNIQUE (team_id, user_id)
);

-- 创建 todos 表
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL CHECK (length(task) >= 1 AND length(task) <= 500),
    is_completed BOOLEAN DEFAULT false,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 启用行级安全
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Teams 表的 RLS 策略
-- 用户可以查看自己创建的团队或自己是成员的团队
CREATE POLICY "teams_select_policy" ON teams
    FOR SELECT
    USING (
        created_by = auth.uid() OR 
        id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
    );

-- 用户可以修改自己创建的团队
CREATE POLICY "teams_update_delete_policy" ON teams
    FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Team Members 表的 RLS 策略
-- 用户可以查看自己的成员记录和同团队的所有成员
CREATE POLICY "team_members_select_policy" ON team_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- 团队创建者可以管理团队成员
CREATE POLICY "team_members_insert_update_delete_policy" ON team_members
    FOR ALL
    USING (
        team_id IN (SELECT id FROM teams WHERE created_by = auth.uid())
    )
    WITH CHECK (
        team_id IN (SELECT id FROM teams WHERE created_by = auth.uid())
    );

-- Todos 表的 RLS 策略
-- 用户可以查看和管理团队中的todos以及个人todos
CREATE POLICY "todos_select_policy" ON todos
    FOR SELECT
    USING (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
            UNION
            -- 用户的个人todo（team_id为null）
            SELECT NULL WHERE auth.uid() IS NOT NULL
        )
    );

CREATE POLICY "todos_insert_update_delete_policy" ON todos
    FOR ALL
    USING (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
            UNION
            -- 用户的个人todo（team_id为null）
            SELECT NULL WHERE auth.uid() IS NOT NULL
        )
    )
    WITH CHECK (
        team_id IN (
            -- 用户作为成员所属的团队
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            UNION
            -- 用户作为创建者的团队
            SELECT id FROM teams WHERE created_by = auth.uid()
            UNION
            -- 用户的个人todo（team_id为null）
            SELECT NULL WHERE auth.uid() IS NOT NULL
        )
    );

-- 创建性能优化索引
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_team_id ON todos(team_id);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);

-- 创建团队统计函数
CREATE OR REPLACE FUNCTION get_user_team_stats(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
    total_teams BIGINT,
    owned_teams BIGINT,
    member_teams BIGINT,
    total_todos BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- 总团队数（创建的 + 加入的）
        (SELECT COUNT(DISTINCT t.id) 
         FROM teams t 
         LEFT JOIN team_members tm ON t.id = tm.team_id 
         WHERE t.created_by = user_uuid OR tm.user_id = user_uuid) as total_teams,
        
        -- 拥有的团队数
        (SELECT COUNT(*) FROM teams WHERE created_by = user_uuid) as owned_teams,
        
        -- 作为成员的团队数
        (SELECT COUNT(*) FROM team_members WHERE user_id = user_uuid) as member_teams,
        
        -- 总 todo 数
        (SELECT COUNT(*) FROM todos WHERE user_id = user_uuid) as total_todos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 验证脚本：检查表和策略是否成功创建
DO $$
BEGIN
    -- 检查表是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        RAISE EXCEPTION 'teams 表创建失败';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        RAISE EXCEPTION 'team_members 表创建失败';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'todos') THEN
        RAISE EXCEPTION 'todos 表创建失败';
    END IF;
    
    -- 检查 RLS 是否启用
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'teams' AND relrowsecurity = true) THEN
        RAISE EXCEPTION 'teams 表 RLS 未启用';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'team_members' AND relrowsecurity = true) THEN
        RAISE EXCEPTION 'team_members 表 RLS 未启用';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'todos' AND relrowsecurity = true) THEN
        RAISE EXCEPTION 'todos 表 RLS 未启用';
    END IF;
    
    -- 检查策略是否存在
    IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'teams') = 0 THEN
        RAISE EXCEPTION 'teams 表策略创建失败';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'team_members') = 0 THEN
        RAISE EXCEPTION 'team_members 表策略创建失败';
    END IF;
    
    IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'todos') = 0 THEN
        RAISE EXCEPTION 'todos 表策略创建失败';
    END IF;
    
    RAISE NOTICE '✅ 数据库初始化成功完成！';
    RAISE NOTICE '📋 已创建表：teams, team_members, todos';
    RAISE NOTICE '🔒 已启用 RLS 并配置安全策略';
    RAISE NOTICE '⚡ 已创建性能优化索引';
    RAISE NOTICE '🔧 已创建辅助函数';
    RAISE NOTICE '⚠️  注意：此脚本基于实际数据库状态同步，移除了不存在的函数和触发器';
END $$;