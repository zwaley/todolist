# 🔧 邀请功能修复指南

> 基于经验教训文档，系统性修复邀请功能问题

---

## 📋 问题诊断

### 根本原因
1. **缺少关键数据库函数**：`get_user_id_by_email` 和 `get_user_id_by_username`
2. **错误处理不完善**：前端错误信息不够详细
3. **用户体验问题**：缺乏用户友好的错误提示
4. **数据完整性**：可能缺少 `user_profiles` 表

### 影响范围
- ✅ 团队创建功能正常
- ✅ 邀请码功能正常
- ❌ 邮箱/用户名邀请功能失败
- ❌ 团队成员显示可能异常

---

## 🛠️ 修复步骤

### 步骤1：执行数据库修复脚本

**在 Supabase Dashboard 的 SQL 编辑器中依次执行：**

1. **修复 RLS 策略**（如果之前有问题）：
   ```sql
   -- 执行 fix-rls-policies.sql
   ```

2. **创建邀请功能函数**：
   ```sql
   -- 执行 fix-invite-functions.sql
   ```

### 步骤2：验证修复状态

```bash
# 运行验证脚本
node verify-invite-fix.js
```

### 步骤3：测试功能

1. **启动应用**：
   ```bash
   npm run dev
   ```

2. **功能测试**：
   - 登录用户账户
   - 创建或进入团队
   - 尝试通过邮箱邀请用户
   - 尝试通过用户名邀请用户
   - 检查错误信息是否友好

---

## 🔍 修复内容详解

### 1. 新增数据库函数

#### `get_user_id_by_email(email text)`
- 通过邮箱查找用户ID
- 确保邮箱已验证
- 返回用户ID或NULL

#### `get_user_id_by_username(username text)`
- 通过用户名查找用户ID
- 支持从 `user_profiles` 表或 `auth.users` 元数据查找
- 返回用户ID或NULL

#### `is_user_team_member(team_id, user_id)`
- 检查用户是否已是团队成员
- 避免重复添加

#### `add_team_member_safe(team_id, user_id)`
- 安全地添加团队成员
- 包含完整的验证逻辑
- 返回结构化的结果

### 2. 用户资料表 (`user_profiles`)

```sql
CREATE TABLE user_profiles (
    id bigserial PRIMARY KEY,
    user_id text REFERENCES auth.users(id),
    username text UNIQUE,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT NOW()
);
```

**特性**：
- 自动触发器：用户注册时自动创建资料
- RLS策略：适当的权限控制
- 索引优化：提升查询性能

### 3. 错误处理改进

#### 前端错误格式
```typescript
// 错误格式：ERROR_CODE|用户友好消息
throw new Error('USER_NOT_FOUND|未找到该用户，请确认邮箱地址是否正确')
```

#### 错误类型
- `UNAUTHORIZED`：未登录
- `INVALID_INPUT`：输入验证失败
- `USER_NOT_FOUND`：用户不存在
- `ALREADY_MEMBER`：已是团队成员
- `DATABASE_ERROR`：数据库操作失败
- `SELF_INVITE`：尝试邀请自己

### 4. 用户体验改进

- **实时验证**：邮箱和用户名格式检查
- **详细提示**：根据错误类型提供具体指导
- **成功反馈**：明确的成功消息
- **自动刷新**：成功后自动更新页面

---

## 🧪 验证清单

### 数据库层面
- [ ] 所有必需函数已创建
- [ ] `user_profiles` 表存在且配置正确
- [ ] RLS策略无递归问题
- [ ] 触发器正常工作

### 应用层面
- [ ] 邮箱邀请功能正常
- [ ] 用户名邀请功能正常
- [ ] 错误信息用户友好
- [ ] 成功邀请后页面更新

### 边界情况
- [ ] 邀请不存在的用户
- [ ] 邀请已存在的成员
- [ ] 邀请自己
- [ ] 无效的邮箱格式
- [ ] 无效的用户名格式

---

## 🚨 注意事项

### 基于经验教训的预防措施

1. **避免RLS递归**：
   - 新函数不在自身表内查询
   - 使用 `SECURITY DEFINER` 避免权限问题

2. **完整的错误处理**：
   - 每个函数都有异常处理
   - 返回结构化的错误信息

3. **性能考虑**：
   - 添加必要的数据库索引
   - 使用 `LIMIT 1` 优化查询

4. **安全性**：
   - 输入验证和清理
   - 适当的RLS策略
   - 防止SQL注入

### 如果修复失败

1. **检查环境变量**：确保 `.env.local` 配置正确
2. **检查权限**：确保使用 `SUPABASE_SERVICE_ROLE_KEY`
3. **查看日志**：检查 Supabase Dashboard 的日志
4. **重新执行**：可以安全地重复执行修复脚本

---

## 📞 故障排除

### 常见问题

**Q: 函数创建失败**
A: 检查是否有足够的数据库权限，确保使用 service role key

**Q: 邀请仍然失败**
A: 运行 `verify-invite-fix.js` 检查所有组件是否正确安装

**Q: 用户资料表为空**
A: 现有用户需要手动创建资料，或者重新注册

**Q: 团队成员不显示**
A: 检查 RLS 策略是否正确，确保没有递归问题

---

## ✅ 修复保证

基于 `LESSONS_LEARNED.md` 中的经验教训，这次修复：

1. **系统性解决**：不是表面修复，而是解决根本问题
2. **完整验证**：提供自动化验证脚本
3. **用户友好**：改善错误处理和用户体验
4. **可维护性**：代码结构清晰，易于调试
5. **安全性**：遵循最佳实践，避免安全漏洞

**这次修复应该是最终解决方案。**

---

*创建时间：2025年7月9日*
*基于：LESSONS_LEARNED.md 和 CODE_QUALITY_IMPROVEMENTS.md*
*状态：待执行*