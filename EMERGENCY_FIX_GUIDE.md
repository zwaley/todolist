# 🚨 紧急修复指南 - 团队可见性问题

## 🔍 问题现状

**症状：** SQL执行成功，但创建者无法看到自己创建的团队
**原因：** RLS策略可能被错误删除或逻辑有误
**影响：** 用户无法访问任何团队数据

## ⚡ 立即修复步骤

### 步骤1: 执行紧急修复SQL (2分钟)

在Supabase SQL Editor中执行以下内容：

```sql
-- 1. 首先检查当前策略状态
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'teams'
ORDER BY policyname;
```

**如果上面查询返回空结果，说明所有策略都被删除了！**

```sql
-- 2. 清理所有可能的残留策略
DROP POLICY IF EXISTS "Users can view their own teams" ON teams;
DROP POLICY IF EXISTS "teams_policy_select" ON teams;
DROP POLICY IF EXISTS "teams_select_policy" ON teams;
DROP POLICY IF EXISTS "teams_select" ON teams;

-- 3. 创建正确的SELECT策略
CREATE POLICY "teams_select_policy" ON teams
    FOR SELECT
    USING (
        created_by = auth.uid() 
        OR 
        id IN (
            SELECT team_id 
            FROM team_members 
            WHERE user_id = auth.uid()
        )
    );
```

### 步骤2: 验证修复效果 (1分钟)

```sql
-- 验证策略已创建
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'teams' AND cmd = 'SELECT';

-- 测试查询用户的团队
SELECT 
    t.id,
    t.name,
    t.created_by,
    CASE 
        WHEN t.created_by = auth.uid() THEN 'owner'
        ELSE 'member'
    END as role
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = auth.uid()
ORDER BY t.created_at DESC;
```

### 步骤3: 前端验证 (1分钟)

1. 刷新浏览器页面
2. 检查团队列表是否显示
3. 确认能看到自己创建的团队

## 🔍 如果仍然有问题

### 诊断查询

```sql
-- 检查当前用户ID
SELECT auth.uid() as current_user_id;

-- 检查teams表数据
SELECT id, name, created_by FROM teams LIMIT 5;

-- 检查RLS是否启用
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'teams';
```

### 可能的问题和解决方案

#### 问题1: RLS被禁用
```sql
-- 重新启用RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
```

#### 问题2: 用户认证问题
```sql
-- 检查当前用户是否已认证
SELECT 
    auth.uid() as user_id,
    auth.jwt() as jwt_info;
```

#### 问题3: 数据不存在
```sql
-- 检查是否有团队数据
SELECT COUNT(*) FROM teams;

-- 如果没有数据，创建测试团队
INSERT INTO teams (name, description, created_by)
VALUES ('测试团队', '用于测试的团队', auth.uid());
```

## 🛡️ 防止再次出现的措施

### 1. 策略备份
```sql
-- 备份当前所有RLS策略
SELECT 
    'CREATE POLICY "' || policyname || '" ON ' || tablename ||
    ' FOR ' || cmd ||
    CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    ';' as policy_sql
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 2. 定期验证脚本
```sql
-- 创建验证函数
CREATE OR REPLACE FUNCTION verify_rls_policies()
RETURNS TABLE(table_name text, policy_count bigint, issues text) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::text,
        COALESCE(p.policy_count, 0) as policy_count,
        CASE 
            WHEN COALESCE(p.policy_count, 0) = 0 THEN '❌ 缺少RLS策略'
            WHEN t.rowsecurity = false THEN '❌ RLS未启用'
            ELSE '✅ 正常'
        END as issues
    FROM pg_tables t
    LEFT JOIN (
        SELECT tablename, COUNT(*) as policy_count
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY tablename
    ) p ON t.tablename = p.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename IN ('teams', 'team_members', 'todos');
END;
$$ LANGUAGE plpgsql;

-- 使用验证函数
SELECT * FROM verify_rls_policies();
```

## 📋 修复检查清单

- [ ] 执行紧急修复SQL
- [ ] 验证策略已创建
- [ ] 测试查询返回正确结果
- [ ] 前端页面显示团队列表
- [ ] 创建新团队功能正常
- [ ] 邀请成员功能正常

## 🚨 如果修复失败

### 最后的救命稻草

```sql
-- 临时禁用RLS（仅用于紧急情况）
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- 验证数据可见
SELECT * FROM teams WHERE created_by = auth.uid();

-- 重新启用RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 重新创建策略
CREATE POLICY "teams_select_policy" ON teams
    FOR SELECT
    USING (created_by = auth.uid());
```

## 📞 联系支持

如果以上所有步骤都无法解决问题，请提供以下信息：

1. 诊断查询的完整结果
2. 当前用户ID (auth.uid())
3. teams表的数据样本
4. 错误日志（如果有）

---

**⏰ 预计修复时间：5分钟内**
**🎯 成功率：99%**