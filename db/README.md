# 📊 数据库文件说明

## 🎯 目录概览

本目录包含了TodoList项目的所有数据库相关文件，分为初始化和迁移两个部分。

## 📁 目录结构

```
db/
├── init/                    # 初始化脚本目录
│   └── 00_initial_setup.sql # 🆕 新项目数据库初始化脚本
└── migrations/              # 数据库迁移文件目录
    ├── V1__*.sql           # 🔄 版本1迁移文件
    ├── V2__*.sql           # 🔄 版本2迁移文件
    ├── V3__*.sql           # 🔄 版本3迁移文件
    ├── V4__*.sql           # 🔄 版本4迁移文件
    ├── V5__*.sql           # 🔄 版本5迁移文件
    └── V6__*.sql           # 🔄 版本6迁移文件
```

## 🚀 使用指南

### 新项目初始化

**适用场景**: 第一次设置数据库，从零开始

**执行步骤**:
1. 打开 Supabase Dashboard → SQL Editor
2. 复制 `init/00_initial_setup.sql` 的全部内容
3. 粘贴到SQL编辑器并执行
4. 验证所有表和策略创建成功

**包含内容**:
- 创建 `teams`、`team_members`、`todos` 表
- 设置所有必要的RLS (Row Level Security) 策略
- 创建必要的函数和触发器
- 建立表之间的关系和约束

### 现有项目更新

**适用场景**: 数据库已存在，需要应用新的变更

**执行顺序**: ⚠️ **必须按版本号顺序执行**

```
V1 → V2 → V3 → V4 → V5 → V6
```

**执行步骤**:
1. 检查当前数据库版本
2. 从下一个版本开始，按顺序执行迁移文件
3. 每执行一个文件后验证结果
4. 记录执行日志

## 📋 迁移文件说明

| 文件 | 描述 | 状态 |
|------|------|------|
| `V1__fix_teams_select_policy.sql` | 修复团队查看策略 | ✅ 稳定 |
| `V1_HOTFIX__fix_teams_select_policy_correct.sql` | 团队策略热修复 | ✅ 稳定 |
| `V2__audit_current_policies.sql` | 审计当前策略状态 | ✅ 稳定 |
| `V3_ROLLBACK__revert_all_policy_changes.sql` | 回退所有策略变更 | ⚠️ 回退用 |
| `V4_FIX__team_members_visibility.sql` | 修复团队成员可见性 | ✅ 稳定 |
| `V5_COMPLETE_FIX__enable_rls_and_policies.sql` | 完整RLS策略修复 | ✅ 推荐 |
| `V6_FINAL_RLS_POLICY_FIX.sql` | 最终RLS策略修复 | ✅ 最新 |

## ⚠️ 重要注意事项

### 执行前检查
- [ ] 确认在正确的Supabase项目中操作
- [ ] 备份重要数据（生产环境必须）
- [ ] 在开发环境先测试
- [ ] 确认有足够的权限执行SQL

### 执行中监控
- [ ] 逐条执行SQL语句，不要一次性执行全部
- [ ] 每执行一条检查是否有错误
- [ ] 如有错误立即停止并分析原因
- [ ] 记录执行过程和结果

### 执行后验证
- [ ] 检查所有表结构正确
- [ ] 验证RLS策略生效
- [ ] 测试应用功能正常
- [ ] 更新数据库版本记录

## 🔄 回退策略

如果迁移执行后出现问题，可以使用以下回退方案：

1. **使用回退文件**: `V3_ROLLBACK__revert_all_policy_changes.sql`
2. **手动回退**: 参考各迁移文件中的回退说明
3. **数据库恢复**: 从备份恢复（最后手段）

## 📞 遇到问题？

1. **查看错误日志**: 仔细阅读SQL执行错误信息
2. **检查策略状态**: 使用验证查询检查当前策略
3. **参考文档**: 查看 `docs/DATABASE_MIGRATION_STRATEGY.md`
4. **记录问题**: 在 `docs/LESSONS_LEARNED.md` 中记录遇到的问题

## 🔗 相关文档

- **数据库状态文档**: `../docs/DATABASE_STATE.md`
- **迁移策略**: `../docs/DATABASE_MIGRATION_STRATEGY.md`
- **执行指南**: `../docs/MIGRATION_EXECUTION_GUIDE.md`
- **经验总结**: `../docs/LESSONS_LEARNED.md`

---

**记住**: 数据库操作需要谨慎，但我们已经做好了充分的准备！ 🚀