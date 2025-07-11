# 团队成员显示问题修复方案

## 📋 基于真实数据库状态的修复计划

**参考文档**: `docs/DATABASE_STATE.md` (2025年7月11日更新)

## 🔍 问题确认

### 1. 实际数据库状态 (已确认)
```sql
-- team_members 表结构 (真实)
team_id      | uuid                     | NO  | null
user_id      | uuid                     | NO  | null  
created_at   | timestamp with time zone | NO  | now()
joined_at    | timestamp with time zone | YES | now()
```

**关键发现**:
- ❌ **没有 `status` 字段**
- ✅ 有 `joined_at` 字段

### 2. 当前RLS策略 (已确认)
```sql
-- team_members 表的 SELECT 策略
POLICY "Team Members: Users can see their own membership record"
FOR SELECT USING (user_id = auth.uid())
```

**问题分析**:
- 用户只能看到自己的成员记录 (`user_id = auth.uid()`)
- 无法看到同团队的其他成员
- 这是导致团队页面只显示自己的根本原因

## 🎯 修复方案

### 方案选择: 修改RLS策略 (推荐)

**原因**:
1. 数据库结构正确，不需要添加字段
2. 业务逻辑需要团队成员能看到彼此
3. 当前策略过于严格，不符合业务需求

### 具体修复步骤

#### 步骤1: 备份当前策略
```sql
-- 备份当前策略 (在Supabase控制台执行)
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'team_members';
```

#### 步骤2: 创建新的RLS策略
```sql
-- 删除现有的限制性策略
DROP POLICY IF EXISTS "Team Members: Users can see their own membership record" ON team_members;

-- 创建新的策略：允许团队成员查看同团队的其他成员
CREATE POLICY "team_members_visibility_policy" ON team_members
    FOR SELECT
    USING (
        -- 用户可以看到自己的成员记录
        user_id = auth.uid() 
        OR 
        -- 用户可以看到自己创建的团队的所有成员
        team_id IN (
            SELECT id FROM teams WHERE created_by = auth.uid()
        )
        OR
        -- 用户可以看到自己所在团队的其他成员
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );
```

#### 步骤3: 验证修复效果
```sql
-- 测试查询：检查用户能看到的团队成员
SELECT tm.team_id, tm.user_id, tm.created_at, tm.joined_at
FROM team_members tm
WHERE tm.team_id = 'YOUR_TEAM_ID';
```

#### 步骤4: 回退方案 (如果需要)
```sql
-- 回退到原始策略
DROP POLICY IF EXISTS "team_members_visibility_policy" ON team_members;

CREATE POLICY "Team Members: Users can see their own membership record" ON team_members
    FOR SELECT
    USING (user_id = auth.uid());
```

## 🔧 代码层面确认

### 当前代码 (无需修改)
```typescript
// src/app/[locale]/teams/[id]/page.tsx
const { data: members } = await supabase
  .from('team_members')
  .select('user_id')
  .eq('team_id', teamId);
```

**说明**: 代码逻辑正确，问题在于RLS策略限制

## ⚠️ 风险评估

### 低风险
- 只修改SELECT策略，不影响数据写入
- 有明确的回退方案
- 不涉及表结构变更

### 预期影响
- ✅ 团队成员能看到同团队的其他成员
- ✅ 团队创建者能看到所有成员
- ✅ 用户仍然只能看到自己相关的团队

## 📝 执行检查清单

### 执行前
- [ ] 已确认 DATABASE_STATE.md 中的表结构
- [ ] 已确认当前RLS策略
- [ ] 已准备回退SQL脚本
- [ ] 已获得用户确认

### 执行中
- [ ] 备份当前策略
- [ ] 执行策略修改
- [ ] 立即测试功能
- [ ] 验证无副作用

### 执行后
- [ ] 更新 DATABASE_STATE.md
- [ ] Git提交修改
- [ ] 记录修复过程
- [ ] 验证长期稳定性

## 🎉 预期结果

修复后，团队页面应该显示:
1. **团队创建者**: 能看到团队的所有成员
2. **普通成员**: 能看到同团队的所有成员
3. **非成员**: 看不到任何成员信息

## 📚 相关文档

- `docs/DATABASE_STATE.md` - 数据库真实状态
- `docs/DATABASE_MANAGEMENT_BEST_PRACTICES.md` - 修改流程规范
- `docs/LESSONS_LEARNED.md` - 历史经验教训

---

**执行原则**: 严格按照步骤执行，每步确认后再进行下一步。如有任何异常，立即执行回退方案。