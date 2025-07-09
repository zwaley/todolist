# 邀请功能数据库函数冲突修复指南

## 问题描述

执行邀请功能修复SQL时遇到错误：
```
ERROR: 42P13: cannot change return type of existing function
HINT: Use DROP FUNCTION get_user_id_by_email(text) first.
```

这个错误表明数据库中已存在同名函数，但返回类型不同，PostgreSQL不允许直接修改函数的返回类型。

## 解决方案

### 方法1：使用安全修复脚本（推荐）

我已经创建了一个安全的修复脚本 `fix-invite-functions-safe.sql`，它会：

1. **安全删除**所有可能冲突的旧函数
2. **重新创建**所有需要的函数
3. **创建必要的表**和索引
4. **设置正确的权限**和RLS策略
5. **验证安装**结果

**执行步骤：**

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 复制并执行 `fix-invite-functions-safe.sql` 的内容
4. 运行验证脚本：`node verify-functions-only.js`

### 方法2：手动清理（如果方法1失败）

如果安全脚本仍然失败，可以手动执行以下SQL：

```sql
-- 1. 删除所有可能冲突的函数
DROP FUNCTION IF EXISTS get_user_id_by_email(text) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_email(varchar) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_username(text) CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_username(varchar) CASCADE;
DROP FUNCTION IF EXISTS is_user_team_member(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS add_team_member_safe(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;

-- 2. 然后执行 fix-invite-functions-safe.sql
```

## 验证修复

执行修复后，运行验证脚本：

```bash
node verify-functions-only.js
```

这个脚本会检查：
- ✅ 所有必需的函数是否存在
- ✅ 函数返回类型是否正确
- ✅ user_profiles 表是否存在
- ✅ 函数是否可以正常调用

## 预期结果

修复成功后，你应该看到：

```
🎉 所有检查通过！邀请功能数据库组件已正确安装。

📝 下一步操作:
1. 在团队页面测试邀请功能
2. 尝试通过邮箱和用户名邀请用户
3. 检查错误处理是否正常工作
```

## 新功能说明

修复后的邀请功能包含：

### 数据库函数
- `get_user_id_by_email(email text)` - 通过邮箱查找用户ID
- `get_user_id_by_username(username text)` - 通过用户名查找用户ID
- `is_user_team_member(team_id bigint, user_id text)` - 检查用户是否已是团队成员
- `create_user_profile()` - 用户注册时自动创建profile

### 数据表
- `user_profiles` - 用户资料表，支持用户名查找

### 前端改进
- 详细的错误处理和用户友好的提示
- 支持邮箱和用户名两种邀请方式
- 实时验证和反馈

## 故障排除

### 如果验证脚本显示函数不存在
1. 检查 Supabase SQL Editor 中是否有错误信息
2. 确认你有足够的数据库权限
3. 尝试手动执行单个函数创建语句

### 如果函数调用失败
1. 检查 RLS 策略是否正确设置
2. 确认 SUPABASE_SERVICE_ROLE_KEY 环境变量正确
3. 查看 Supabase Dashboard 的日志

### 如果仍有问题
1. 在 Supabase Dashboard 查看详细错误日志
2. 检查数据库连接和权限
3. 尝试重新创建 Supabase 项目（最后手段）

## 重要提醒

- ⚠️ 执行SQL脚本前建议备份数据库
- ⚠️ 确保在正确的 Supabase 项目中执行
- ⚠️ 如果是生产环境，请先在开发环境测试
- ✅ 修复完成后记得测试所有邀请功能

---

**下一步：** 执行 `fix-invite-functions-safe.sql` 然后运行 `node verify-functions-only.js`