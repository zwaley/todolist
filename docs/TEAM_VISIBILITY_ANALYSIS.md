# 团队可见性问题分析报告

## 🔍 问题描述

用户反映：**只能查看自己创建的团队，无法查看被邀请加入的团队**

## 📊 代码分析结果

### 1. 查询逻辑分析

查看 `src/app/[locale]/page.tsx` 第20-30行的代码：

```typescript
// 获取用户所属的团队（包括被邀请加入的）
const { data: teams, error: teamsError } = await supabase
  .from('team_members')  // 从team_members表查询
  .select(`
    teams (
      id,
      name,
      todos (
        id,
        is_completed
      )
    )
  `)
  .eq('user_id', user.id)  // 查询当前用户的所有成员记录
```

**结论：查询逻辑是正确的**
- 通过 `team_members` 表查询用户的所有成员记录
- 包括用户自己创建的团队和被邀请加入的团队
- 使用关联查询获取团队详细信息

### 2. 问题根源分析

**真正的问题在于RLS策略配置不完整：**

#### 当前项目中的策略文件：
- ✅ `V1__fix_team_members_insert_policy.sql` - 仅包含INSERT策略
- ❌ 缺少 `team_members` 表的 SELECT 策略
- ❌ 缺少 `teams` 表的 SELECT 策略

#### 之前在数据库后台执行的策略（未在代码中记录）：
```sql
-- team_members表SELECT策略
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    auth.uid() = user_id  -- 用户可以查看自己的成员记录
    OR
    team_id IN (  -- 或者是团队创建者
      SELECT id FROM teams WHERE created_by = auth.uid()
    )
  );

-- teams表SELECT策略
CREATE POLICY "Users can view teams" ON teams
  FOR SELECT USING (
    created_by = auth.uid()  -- 用户可以查看自己创建的团队
    OR
    id IN (  -- 或者用户是团队成员的团队
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );
```

## 🎯 解决方案

### 已创建的迁移文件：

1. **V2__fix_teams_select_policy.sql**
   - 修复 `teams` 表的 SELECT 策略
   - 允许用户查看自己创建的团队和自己是成员的团队

2. **V3__fix_team_members_select_policy.sql**
   - 修复 `team_members` 表的 SELECT 策略
   - 避免无限递归问题
   - 允许用户查看相关的团队成员信息

3. **V4__comprehensive_rls_fix.sql**
   - 综合修复所有RLS策略
   - 包含INSERT、UPDATE、DELETE策略
   - 确保完整的权限控制

### 执行步骤：

1. **在Supabase Dashboard中执行迁移文件**：
   ```sql
   -- 按顺序执行
   -- V2__fix_teams_select_policy.sql
   -- V3__fix_team_members_select_policy.sql
   -- V4__comprehensive_rls_fix.sql
   ```

2. **验证修复效果**：
   ```sql
   -- 检查所有策略
   SELECT 
     tablename,
     policyname,
     cmd,
     permissive
   FROM pg_policies 
   WHERE tablename IN ('teams', 'team_members')
   ORDER BY tablename, policyname;
   ```

## 🔄 问题复现场景

### 当前状态（有问题）：
1. 用户A创建团队X
2. 用户A邀请用户B加入团队X
3. 用户B登录后，在首页看不到团队X
4. 原因：缺少 `team_members` 表的 SELECT 策略

### 修复后状态（正常）：
1. 用户A创建团队X
2. 用户A邀请用户B加入团队X
3. 用户B登录后，在首页可以看到团队X
4. 原因：RLS策略允许用户查看自己的成员记录

## 📝 技术总结

**用户的判断是正确的：**
- 之前确实在数据库后台直接执行了RLS策略修复
- 但这些修复没有反映在项目代码中
- 导致代码和数据库状态不一致
- 现在已经创建了相应的迁移文件来同步状态

**关键教训：**
- 所有数据库修改都应该通过迁移文件记录
- 避免直接在数据库后台执行SQL而不在代码中记录
- 保持代码和数据库状态的一致性

---

**创建时间：** 2024年12月
**状态：** 已分析，待执行迁移
**优先级：** 高