# 📚 开发经验教训总结

> 记录开发过程中犯的错误和学到的经验，避免重复犯同样的错误

---

## 🚨 重大错误与教训

### 1. 数据库RLS策略设计错误

#### ❌ 错误做法
```sql
-- 在team_members表上创建策略，但条件又查询team_members表
CREATE POLICY "Users can view team members" ON team_members
    FOR SELECT USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
            -- ↑ 这里形成了无限递归！
        )
    );
```

#### ✅ 正确做法
```sql
-- 使用其他表来验证权限，避免自引用
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    team_id IN (
      SELECT id FROM teams WHERE created_by = auth.uid()
      -- ↑ 使用teams表验证，避免递归
    )
  );
```

#### 📝 教训
- **永远不要在RLS策略中查询策略所在的表本身**
- 设计RLS策略时要画出权限验证的流程图
- 每个策略创建后立即测试，不要批量创建

---

### 2. 错误诊断方向偏差

#### ❌ 错误思路
1. **表面现象分析**：看到NEXT_REDIRECT错误就认为是Next.js问题
2. **局部修复**：只修复表结构，忽略RLS策略问题
3. **经验主义**：基于以往经验猜测问题，而不是深入分析

#### ✅ 正确思路
1. **系统性分析**：从数据库到应用层全面检查
2. **根因分析**：找到问题的根本原因，而不是表面症状
3. **验证驱动**：每个修复都要有具体的验证方法

#### 📝 教训
- **错误信息可能具有误导性**，要深入分析真正的根因
- **系统性思考**比局部修复更重要
- **建立完整的诊断流程**，不要跳步骤

---

### 3. 缺乏有效的验证机制

#### ❌ 错误做法
- 修复后只是手动测试一下
- 没有可重复的验证方法
- 依赖主观判断而不是客观数据

#### ✅ 正确做法
- 创建自动化验证脚本
- 建立可重复的测试流程
- 提供具体的技术证据

#### 📝 教训
- **每个修复都要有对应的验证脚本**
- **可重复性**是验证有效性的关键
- **技术证据**比主观判断更可靠

---

### 4. Next.js 15兼容性问题

#### ❌ 错误做法
```typescript
// 在Server Component中直接使用异步操作
export default function Page({ params }: { params: { id: string } }) {
  // 这样会导致兼容性问题
}
```

#### ✅ 正确做法
```typescript
// 正确处理异步参数
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // 正确的异步处理
}
```

#### 📝 教训
- **升级框架版本时要仔细阅读迁移指南**
- **异步API的变化要特别注意**
- **类型定义的变化也很重要**

---

### 5. 错误处理机制不完善

#### ❌ 错误做法
```typescript
// 简单的try-catch，没有详细的错误信息
try {
  await createTeam(data);
} catch (error) {
  console.log('创建失败');
}
```

#### ✅ 正确做法
```typescript
// 完善的错误处理和日志记录
try {
  await createTeam(data);
} catch (error) {
  const errorResult = handleError('团队创建', error, { 
    formData: data,
    timestamp: new Date().toISOString()
  });
  // 详细的错误日志和用户友好的错误信息
}
```

#### 📝 教训
- **错误处理要包含足够的上下文信息**
- **用户友好的错误信息很重要**
- **详细的错误日志有助于调试**

---

## 🛠️ 开发流程改进

### 1. 问题诊断流程

```
1. 收集错误信息和日志
   ↓
2. 系统性分析（数据库 → 后端 → 前端）
   ↓
3. 创建最小复现案例
   ↓
4. 根因分析（不要被表面现象误导）
   ↓
5. 设计修复方案
   ↓
6. 创建验证脚本
   ↓
7. 实施修复
   ↓
8. 验证修复效果
   ↓
9. 记录经验教训
```

### 2. 代码质量保证

- **每个功能都要有对应的错误处理**
- **数据库操作要考虑权限和安全性**
- **API设计要考虑边界情况**
- **用户体验要友好**

### 3. 文档和备份

- **重要修复要有详细的文档记录**
- **定期提交代码到git**
- **保留诊断脚本和验证工具**

---

## 🎯 具体的技术陷阱

### 1. Supabase RLS策略

**常见错误**：
- 在策略中查询策略所在的表（无限递归）
- 权限验证逻辑过于复杂
- 没有考虑性能影响

**最佳实践**：
- 策略逻辑要简单明确
- 避免自引用查询
- 每个策略单独测试

### 2. Next.js Server Components

**常见错误**：
- 异步参数处理不当
- 客户端和服务端代码混淆
- 状态管理不当

**最佳实践**：
- 严格区分Server和Client Components
- 正确处理异步操作
- 合理使用状态管理

### 3. 错误处理

**常见错误**：
- 错误信息不够详细
- 没有用户友好的提示
- 缺乏错误恢复机制

**最佳实践**：
- 统一的错误处理机制
- 详细的错误日志
- 用户友好的错误提示

### 4. NEXT_REDIRECT错误的真正原因

**常见错误**：
- 复杂的错误处理逻辑导致NEXT_REDIRECT错误，而非数据库或中间件问题
- 过度复杂的try-catch和错误信息构建逻辑会干扰Next.js的重定向机制
- 误以为是数据库RLS策略或中间件配置问题

**最佳实践**：
- Server Actions应保持简洁，减少嵌套的错误处理
- 直接使用redirect()而不是return redirect()
- 复杂的错误处理应在客户端组件中实现
- 先检查Server Actions的复杂度，再排查其他问题

---

## 📋 检查清单

### 开发前
- [ ] 阅读相关文档和最佳实践
- [ ] 设计数据库结构和权限策略
- [ ] 规划错误处理机制

### 开发中
- [ ] 每个功能都要有错误处理
- [ ] 定期测试和验证
- [ ] 及时提交代码

### 开发后
- [ ] 创建验证脚本
- [ ] 完善文档
- [ ] 记录经验教训

### 修复Bug时
- [ ] 系统性分析问题
- [ ] 找到根本原因
- [ ] 创建验证方法
- [ ] 实施修复
- [ ] 验证效果
- [ ] 更新文档

---

## 🔮 未来改进方向

### 1. 自动化测试
- 添加单元测试
- 集成测试
- 端到端测试

### 2. 监控和日志
- 应用性能监控
- 错误追踪
- 用户行为分析

### 3. 代码质量
- 代码审查流程
- 静态代码分析
- 性能优化

---

## 数据库相关

### RLS策略配置
- 所有数据库修改都应通过迁移文件记录，避免代码和数据库状态不一致
- RLS策略修复应该直接在Supabase Dashboard中执行，而非通过迁移文件
- 团队可见性问题的根本原因是缺少数据库RLS策略的SELECT权限配置

### RLS策略当前状态 (确认日期: 2024-12-19)
**team_members表策略:**
- "Users can view team members" (SELECT): 允许用户查看自己的成员记录或自己创建团队的成员
- "Team owners can manage members" (ALL): 团队创建者可以管理所有成员
- "Users can join teams" (INSERT): 用户可以加入团队
- "Users can leave teams" (DELETE): 用户可以离开团队

**teams表策略:**
- "Users can view their own teams" (SELECT): 用户只能查看自己创建的团队
- "teams_policy_select" (SELECT): 重复策略，功能相同
- "Team creators can update their teams" (UPDATE): 团队创建者可以更新自己的团队
- "teams_policy_insert" (INSERT): 允许插入新团队
- "teams_policy_delete" (DELETE): 团队创建者可以删除自己的团队
- "teams_policy_update" (UPDATE): 重复策略，功能相同

**验证方法:**
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('teams', 'team_members')
ORDER BY tablename, policyname;
```

**注意事项:**
- teams表存在重复的SELECT和UPDATE策略，但不影响功能
- 所有策略配置正确，团队可见性功能应该正常工作
- 相关代码注释已在 `src/app/[locale]/page.tsx` 中更新

---

*最后更新：2025年7月9日*
*状态：持续更新*
*目标：避免重复犯错，提升开发效率*