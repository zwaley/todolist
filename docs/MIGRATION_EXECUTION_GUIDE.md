# 数据库迁移执行指南

## 🎯 当前待执行的迁移

### 执行顺序（必须按顺序执行）

1. **V1__fix_teams_select_policy.sql** - 修复团队可见性问题
2. **V2__audit_current_policies.sql** - 清理和标准化策略

## 📋 执行步骤

### 第一步：执行V1迁移

**目的：** 解决当前团队可见性问题

**操作：**
1. 打开 Supabase Dashboard > SQL Editor
2. 复制 `db/migrations/V1__fix_teams_select_policy.sql` 的内容
3. 执行SQL
4. 验证结果：用户应该能看到被邀请加入的团队

**验证查询：**
```sql
-- 验证新策略是否生效
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'teams' AND cmd = 'SELECT';
```

**预期结果：** 应该看到新策略 "Users can view accessible teams"

### 第二步：测试功能

**测试步骤：**
1. 在前端登录用户1
2. 检查首页是否显示两个团队（自己创建的 + 被邀请的）
3. 登录用户2
4. 检查首页是否显示两个团队（自己创建的 + 被邀请的）

**如果测试失败：**
- 检查策略是否正确创建
- 查看浏览器控制台错误
- 检查Supabase日志

### 第三步：Git提交

**重要：** 功能验证成功后立即提交

```bash
git add .
git commit -m "fix: 修复团队可见性问题 - 允许用户查看被邀请加入的团队

- 创建V1迁移文件修复teams表SELECT策略
- 建立数据库迁移管理策略
- 解决用户只能看到自己创建团队的问题"
```

### 第四步：执行V2迁移（可选）

**目的：** 清理重复策略，标准化命名

**注意：** 此步骤不是紧急的，可以在V1验证成功后再执行

## 🚨 安全检查清单

**执行前：**
- [ ] 确认当前开发服务器正常运行
- [ ] 备份重要数据（如有需要）
- [ ] 确认在开发环境执行，不是生产环境

**执行中：**
- [ ] 逐条执行SQL，不要一次性执行全部
- [ ] 每执行一条都检查是否有错误
- [ ] 如有错误立即停止并分析

**执行后：**
- [ ] 运行验证查询确认策略正确
- [ ] 测试前端功能正常
- [ ] 提交代码到Git
- [ ] 更新文档记录执行结果

## 🔄 回退计划

**如果V1执行后出现问题：**

```sql
-- 回退V1迁移
DROP POLICY IF EXISTS "Users can view accessible teams" ON teams;

-- 恢复原策略
CREATE POLICY "Users can view their own teams" ON teams
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "teams_policy_select" ON teams
  FOR SELECT USING (created_by = auth.uid());
```

## 📞 遇到问题时

1. **检查错误信息** - 仔细阅读SQL执行错误
2. **查看策略状态** - 使用验证查询检查当前策略
3. **测试权限** - 使用之前的用户身份测试SQL
4. **回退变更** - 如有必要，使用回退计划
5. **记录问题** - 在 `LESSONS_LEARNED.md` 中记录遇到的问题

---

**记住：数据库变更需要谨慎，但我们已经做好了充分的准备！**