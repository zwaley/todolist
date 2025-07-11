# 数据库管理最佳实践指南

## 📋 目标

避免数据库结构与代码不一致导致的重复错误，建立可靠的数据库状态管理流程。

## 🔍 问题根源分析

### 1. 核心问题
- **数据库结构与初始化脚本不一致**
- **缺乏数据库状态的实时跟踪**
- **修改前未充分验证当前状态**
- **缺乏系统性的回退机制**

### 2. 具体表现
- `team_members` 表实际没有 `status` 字段，但代码期望有
- RLS策略与业务需求不匹配
- 触发器依赖的函数不存在
- 多次重复相同的错误修复尝试

## 🎯 最佳实践规范

### 1. 数据库状态管理

#### 1.1 状态文档维护
- **必须维护**: `docs/DATABASE_STATE.md` 作为数据库真实状态的唯一权威文档
- **更新频率**: 每次数据库结构变更后立即更新
- **内容要求**: 包含表结构、约束、RLS策略、触发器、函数的完整信息

#### 1.2 状态验证流程
```sql
-- 1. 检查表结构
SELECT table_name, column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

-- 2. 检查RLS策略
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. 检查触发器
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- 4. 检查函数
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public';
```

### 2. 修改前检查清单

#### 2.1 必须执行的检查步骤
1. **读取当前状态文档** (`docs/DATABASE_STATE.md`)
2. **验证实际数据库状态** (执行上述SQL查询)
3. **对比文档与实际状态** (发现不一致立即更新文档)
4. **分析问题根本原因** (避免症状修复)
5. **制定完整修复方案** (包括回退计划)

#### 2.2 检查清单模板
```markdown
- [ ] 已读取 DATABASE_STATE.md
- [ ] 已验证表结构与文档一致
- [ ] 已验证RLS策略与文档一致
- [ ] 已验证触发器与函数存在性
- [ ] 已分析问题根本原因
- [ ] 已制定回退方案
- [ ] 已获得用户确认
```

### 3. 安全修改流程

#### 3.1 修改前准备
1. **备份当前策略**
```sql
-- 导出当前RLS策略
\copy (SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public') TO 'backup_policies.csv' CSV HEADER;
```

2. **创建回退脚本**
```sql
-- 示例回退脚本
-- backup_rollback.sql
DROP POLICY IF EXISTS "new_policy_name" ON table_name;
CREATE POLICY "old_policy_name" ON table_name FOR SELECT USING (old_condition);
```

#### 3.2 修改执行
1. **小步骤修改** (一次只改一个策略/表)
2. **立即测试** (每步修改后验证功能)
3. **记录变更** (更新 DATABASE_STATE.md)
4. **Git提交** (每个成功的修改立即提交)

#### 3.3 修改后验证
1. **功能测试** (验证修改达到预期效果)
2. **回归测试** (确保未破坏现有功能)
3. **文档更新** (同步更新所有相关文档)

### 4. 错误预防机制

#### 4.1 自动化检查
创建数据库状态检查脚本:
```sql
-- db_health_check.sql
-- 检查触发器函数是否存在
SELECT t.trigger_name, t.event_object_table, 
       CASE WHEN p.proname IS NULL THEN 'MISSING FUNCTION' ELSE 'OK' END as status
FROM information_schema.triggers t
LEFT JOIN pg_proc p ON p.proname = regexp_replace(t.action_statement, '.*FUNCTION\s+(\w+)\(.*', '\\1')
WHERE t.trigger_schema = 'public';
```

#### 4.2 定期审计
- **每周**: 执行数据库健康检查
- **每月**: 全面对比文档与实际状态
- **每次部署前**: 完整的状态验证

### 5. 团队协作规范

#### 5.1 沟通协议
- **修改前**: 必须先进行状态检查和问题分析
- **修改中**: 一次只执行一个操作，等待确认
- **修改后**: 立即更新文档和提交代码

#### 5.2 文档维护责任
- **开发者**: 负责更新 DATABASE_STATE.md
- **团队**: 定期审查文档准确性
- **项目**: 将文档作为唯一权威数据源

## 🚨 应急处理

### 1. 发现不一致时
1. **立即停止修改**
2. **记录发现的不一致**
3. **更新 DATABASE_STATE.md**
4. **重新分析问题**
5. **制定新的修复方案**

### 2. 修改失败时
1. **立即执行回退脚本**
2. **验证回退成功**
3. **分析失败原因**
4. **更新预防措施**
5. **重新制定方案**

## 📊 成功指标

- **零重复错误**: 同样的问题不再重复出现
- **文档一致性**: DATABASE_STATE.md 与实际状态100%一致
- **修改成功率**: 数据库修改一次成功率 > 95%
- **回退时间**: 出现问题时5分钟内完成回退

## 🔄 持续改进

1. **记录所有错误和解决方案**
2. **定期回顾和优化流程**
3. **更新最佳实践指南**
4. **分享经验教训**

---

**重要提醒**: 这个指南的核心是"先检查，再行动"。任何数据库相关的修改都必须先执行完整的状态检查流程。