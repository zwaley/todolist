-- 数据库完整初始化脚本
-- 用于新环境的完整部署
-- 执行顺序: 在全新的Supabase项目中执行

-- =============================================
-- 1. 创建表结构
-- =============================================

-- 创建teams表
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建team_members表
CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    UNIQUE(team_id, user_id)
);

-- 创建todos表
CREATE TABLE IF NOT EXISTS todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. 启用RLS
-- =============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. 创建RLS策略 - Teams表
-- =============================================

-- Teams SELECT策略: 用户可以查看自己创建的团队和自己是成员的团队
CREATE POLICY "teams_select_policy" ON teams
    FOR SELECT
    USING (
        created_by = auth.uid() OR 
        id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        )
    );

-- Teams INSERT策略: 用户只能创建自己的团队
CREATE POLICY "teams_insert_policy" ON teams
    FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Teams UPDATE策略: 用户只能更新自己创建的团队
CREATE POLICY "teams_update_policy" ON teams
    FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Teams DELETE策略: 用户只能删除自己创建的团队
CREATE POLICY "teams_delete_policy" ON teams
    FOR DELETE
    USING (created_by = auth.uid());

-- =============================================
-- 4. 创建RLS策略 - Team Members表
-- =============================================

-- Team Members SELECT策略: 用户可以查看自己相关的成员记录
CREATE POLICY "team_members_select_policy" ON team_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR 
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- Team Members INSERT策略: 团队创建者可以邀请成员
CREATE POLICY "team_members_insert_policy" ON team_members
    FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- Team Members UPDATE策略: 团队创建者和成员本人可以更新
CREATE POLICY "team_members_update_policy" ON team_members
    FOR UPDATE
    USING (
        user_id = auth.uid() OR 
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() OR 
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- Team Members DELETE策略: 团队创建者和成员本人可以删除
CREATE POLICY "team_members_delete_policy" ON team_members
    FOR DELETE
    USING (
        user_id = auth.uid() OR 
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
    );

-- =============================================
-- 5. 创建RLS策略 - Todos表
-- =============================================

-- Todos SELECT策略: 用户可以查看自己团队的todos
CREATE POLICY "todos_select_policy" ON todos
    FOR SELECT
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        ) OR
        team_id IN (
            SELECT id 
            FROM teams 
            WHERE created_by = auth.uid()
        )
    );

-- Todos INSERT策略: 用户可以在自己的团队中创建todos
CREATE POLICY "todos_insert_policy" ON todos
    FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        ) OR
        team_id IN (
            SELECT id 
            FROM teams 
            WHERE created_by = auth.uid()
        )
    );

-- Todos UPDATE策略: 用户可以更新自己团队的todos
CREATE POLICY "todos_update_policy" ON todos
    FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        ) OR
        team_id IN (
            SELECT id 
            FROM teams 
            WHERE created_by = auth.uid()
        )
    )
    WITH CHECK (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        ) OR
        team_id IN (
            SELECT id 
            FROM teams 
            WHERE created_by = auth.uid()
        )
    );

-- Todos DELETE策略: 用户可以删除自己团队的todos
CREATE POLICY "todos_delete_policy" ON todos
    FOR DELETE
    USING (
        team_id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        ) OR
        team_id IN (
            SELECT id 
            FROM teams 
            WHERE created_by = auth.uid()
        )
    );

-- =============================================
-- 6. 创建索引优化性能
-- =============================================

-- Teams表索引
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at);

-- Team Members表索引
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- Todos表索引
CREATE INDEX IF NOT EXISTS idx_todos_team_id ON todos(team_id);
CREATE INDEX IF NOT EXISTS idx_todos_created_by ON todos(created_by);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

-- =============================================
-- 7. 创建有用的函数
-- =============================================

-- 获取用户的团队统计
CREATE OR REPLACE FUNCTION get_user_team_stats(user_uuid UUID)
RETURNS TABLE (
    total_teams BIGINT,
    owned_teams BIGINT,
    member_teams BIGINT,
    pending_invites BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (
            SELECT COUNT(*) 
            FROM teams t 
            LEFT JOIN team_members tm ON t.id = tm.team_id 
            WHERE t.created_by = user_uuid OR (tm.user_id = user_uuid AND tm.status = 'accepted')
        ) as total_teams,
        (
            SELECT COUNT(*) 
            FROM teams 
            WHERE created_by = user_uuid
        ) as owned_teams,
        (
            SELECT COUNT(*) 
            FROM team_members 
            WHERE user_id = user_uuid AND status = 'accepted'
        ) as member_teams,
        (
            SELECT COUNT(*) 
            FROM team_members 
            WHERE user_id = user_uuid AND status = 'pending'
        ) as pending_invites;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 8. 验证脚本
-- =============================================

-- 验证所有表都已创建
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        RAISE EXCEPTION 'teams表创建失败';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        RAISE EXCEPTION 'team_members表创建失败';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'todos') THEN
        RAISE EXCEPTION 'todos表创建失败';
    END IF;
    
    RAISE NOTICE '✅ 所有表创建成功';
END $$;

-- 验证RLS策略
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE tablename IN ('teams', 'team_members', 'todos');
    
    IF policy_count < 12 THEN
        RAISE EXCEPTION 'RLS策略数量不足，期望至少12个，实际%个', policy_count;
    END IF;
    
    RAISE NOTICE '✅ RLS策略创建成功，共%个策略', policy_count;
END $$;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '🎉 数据库初始化完成！';
    RAISE NOTICE '📋 下一步: 配置环境变量并启动应用';
END $$;