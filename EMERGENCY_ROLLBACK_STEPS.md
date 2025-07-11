# 紧急回退操作步骤

## 第一步：复制以下SQL代码

```sql
-- 紧急回退脚本
-- 目标：撤销所有最近的RLS策略变更，恢复到最基本、最稳定的状态
-- 执行此脚本将删除所有在teams, team_members, todos表上的策略，然后重建最核心的策略

-- =============================================
-- 1. 清理所有相关表的RLS策略
-- =============================================

-- 清理 teams 表策略
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'teams')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON teams;';
    END LOOP;
END $$;

-- 清理 team_members 表策略
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON team_members;';
    END LOOP;
END $$;

-- 清理 todos 表策略
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'todos')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON todos;';
    END LOOP;
END $$;

-- =============================================
-- 2. 重建最基本、最稳定的RLS策略
-- =============================================

-- Teams表：用户只能操作自己创建的团队
CREATE POLICY "teams_owner_all_access" ON teams
    FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Team Members表：用户只能看到自己的成员记录
CREATE POLICY "team_members_self_select" ON team_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Todos表：用户只能操作自己创建的团队中的todo
CREATE POLICY "todos_owner_all_access" ON todos
    FOR ALL
    USING (team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()))
    WITH CHECK (team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()));

-- =============================================
-- 3. 验证回退结果
-- =============================================

-- 检查策略是否已恢复到基本状态
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members', 'todos')
ORDER BY tablename, policyname;
```

## 第二步：在Supabase中执行SQL

1. 登录到您的 **Supabase Dashboard**
2. 在左侧菜单中，找到并点击 **SQL Editor**
3. 点击 **New query** 按钮，打开一个新的查询窗口
4. 将上面代码框中的所有SQL代码**粘贴**到这个查询窗口中
5. 点击 **RUN** 按钮来执行脚本

## 第三步：验证结果

执行完SQL后，请回到您的应用界面，**强制刷新**一下页面（通常是 `Ctrl+F5` 或 `Cmd+Shift+R`），然后测试以下功能：

* **新增个人Todo**：是否可以成功添加？
* **创建新团队**：是否可以成功创建？
* **查看已有团队**：您之前创建的团队是否能正常显示？

## 预期结果

* 核心功能应该恢复正常
* 团队协作功能（如查看作为成员加入的团队）将暂时不可用，这是预期的暂时状态

## 注意事项

这是一个紧急回退方案，旨在恢复系统的基本功能。在确认核心功能恢复后，我们可以再制定一个正确的修复方案来完善团队协作功能。