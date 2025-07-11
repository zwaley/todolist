# 数据库迁移管理策略

## 🚨 问题背景

当前项目存在数据库策略管理混乱的问题：
- 部分RLS策略直接在数据库后台执行，未在代码中记录
- 缺乏统一的迁移文件管理
- 可能导致开发环境与生产环境不一致

## 🎯 解决方案

### 1. 建立完整的迁移文件体系

**目录结构：**
```
db/
├── migrations/
│   ├── V1__fix_teams_select_policy.sql
│   ├── V2__fix_team_members_policies.sql
│   └── V3__comprehensive_rls_audit.sql
├── seeds/
│   └── initial_data.sql
└── scripts/
    ├── apply_migrations.sql
    └── rollback_template.sql
```

### 2. 迁移文件命名规范

**格式：** `V{版本号}__{描述}.sql`
- V1, V2, V3... 按顺序递增
- 描述使用英文，简洁明了
- 每个文件只处理一个逻辑功能

### 3. 当前需要创建的迁移文件

#### V1__fix_teams_select_policy.sql ✅ 已创建
- 修复teams表SELECT策略
- 允许用户查看被邀请加入的团队

#### V2__audit_current_policies.sql 📋 需要创建
- 记录当前所有RLS策略的状态
- 作为基线参考

#### V3__standardize_policy_names.sql 📋 需要创建
- 统一策略命名规范
- 清理重复策略

### 4. 执行流程

**开发环境：**
1. 创建迁移文件
2. 在Supabase Dashboard中测试
3. 确认无误后提交代码
4. 更新文档

**生产环境：**
1. 按版本号顺序执行迁移文件
2. 记录执行日志
3. 验证功能正常

### 5. 回退策略

每个迁移文件都应包含：
```sql
-- 执行部分
-- 修复逻辑...

-- 回退部分（注释形式）
/*
ROLLBACK INSTRUCTIONS:
1. 恢复原策略：
   CREATE POLICY "old_policy_name" ON table_name...
2. 删除新策略：
   DROP POLICY "new_policy_name" ON table_name;
*/
```

### 6. 文档同步

**必须更新的文档：**
- `LESSONS_LEARNED.md` - 记录策略变更
- `README.md` - 更新部署说明
- 本文档 - 记录迁移历史

## 📋 立即行动计划

1. **执行V1迁移** - 修复当前团队可见性问题
2. **创建V2迁移** - 审计并记录所有现有策略
3. **建立迁移执行日志** - 记录每次变更
4. **Git提交** - 确保所有变更都在版本控制中

## 🔒 安全原则

- 所有数据库变更必须先在开发环境测试
- 重要变更需要备份数据
- 每次迁移后验证功能完整性
- 保持迁移文件的幂等性（可重复执行）

---

**这样确保了所有数据库变更都有迹可循，避免了"黑盒操作"的风险！**