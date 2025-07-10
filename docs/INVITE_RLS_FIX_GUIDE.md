# 🔧 邀请功能RLS策略修复指南

## 🚨 问题描述

当前邀请功能出现以下错误：
```
new row violates row-level security policy for table "team_members"
```

**根本原因**：当前的RLS策略只允许用户添加自己为团队成员，但邀请功能需要团队创建者能够添加其他用户。

## 🛠️ 修复步骤

### 步骤1：打开Supabase Dashboard
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 "SQL Editor"

### 步骤2：执行修复SQL

复制以下SQL代码并在SQL Editor中执行：

```sql
-- 修复邀请功能的RLS策略问题
-- 删除有问题的策略
DROP POLICY IF EXISTS "Users can join teams" ON team_members;

-- 创建新的策略，允许团队创建者邀请其他用户
CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (
    -- 用户可以添加自己
    auth.uid() = user_id
    OR
    -- 或者当前用户是团队的创建者（可以邀请其他用户）
    team_id IN (
      SELECT id FROM teams WHERE created_by = auth.uid()
    )
  );

-- 验证策略
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'team_members' AND policyname = 'Users can join teams';

SELECT '邀请功能RLS策略修复完成' AS status;
```

### 步骤3：验证修复

执行SQL后，你应该看到：
- 策略删除和创建的确认消息
- 新策略的详细信息
- "邀请功能RLS策略修复完成" 状态消息

## 🧪 测试修复效果

### 方法1：运行测试脚本

在项目根目录运行：
```bash
node test-invite-after-fix.js
```

### 方法2：手动测试

1. 打开浏览器，访问 http://localhost:3002
2. 登录到你的账户
3. 进入一个你创建的团队
4. 尝试邀请一个用户（使用邮箱或用户名）
5. 确认不再出现RLS策略错误

## 🔍 故障排除

### 如果仍然出现错误

1. **检查策略是否正确创建**：
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'team_members';
   ```

2. **检查用户权限**：
   确保你是团队的创建者

3. **检查数据库函数**：
   ```sql
   SELECT * FROM pg_proc WHERE proname IN ('get_user_id_by_email', 'get_user_id_by_username');
   ```

### 常见问题

**Q: 执行SQL时出现权限错误**
A: 确保你使用的是service_role密钥，或者在Supabase Dashboard中以管理员身份执行

**Q: 策略创建成功但邀请仍然失败**
A: 检查邀请的用户是否存在，以及是否已经是团队成员

**Q: 找不到用户**
A: 确保用户已注册并且邮箱已验证

## 📋 修复前后对比

### 修复前的策略
```sql
CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```
**问题**：只允许用户添加自己

### 修复后的策略
```sql
CREATE POLICY "Users can join teams" ON team_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id  -- 用户可以添加自己
    OR
    team_id IN (          -- 团队创建者可以添加其他用户
      SELECT id FROM teams WHERE created_by = auth.uid()
    )
  );
```
**改进**：允许团队创建者邀请其他用户

## ✅ 验证清单

- [ ] SQL执行成功，无错误消息
- [ ] 新策略在pg_policies表中可见
- [ ] 测试脚本运行成功
- [ ] 在浏览器中可以成功邀请用户
- [ ] 不再出现RLS策略错误

---

**注意**：这个修复是针对当前发现的具体RLS策略问题。如果还有其他邀请相关的问题，可能需要进一步调试。