# 🤝 Contributing to TodoList

感谢您对TodoList项目的贡献！本指南将帮助您快速上手并有效地参与项目开发。

## 🚀 快速开始

### 环境准备

1. **系统要求**:
   - Node.js 18+
   - Git
   - 现代浏览器

2. **获取代码**:
   ```bash
   git clone <repository-url>
   cd todolist
   npm install
   ```

3. **数据库设置**:
   - 创建Supabase项目
   - 执行 `db/init/00_initial_setup.sql`
   - 配置环境变量

4. **启动开发**:
   ```bash
   npm run dev
   ```

详细步骤请参考 [README.md](./README.md) 的快速开始指南。

## 📋 开发流程

### 1. 创建功能分支

```bash
# 从main分支创建新分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

**分支命名规范**:
- `feature/功能名称` - 新功能开发
- `fix/问题描述` - Bug修复
- `docs/文档更新` - 文档更新
- `refactor/重构描述` - 代码重构

### 2. 开发代码

- 遵循现有代码风格
- 添加必要的注释
- 编写或更新测试
- 确保功能完整可用

### 3. 提交代码

**提交信息格式**:
```
类型(范围): 简短描述

详细描述（可选）

相关Issue: #123
```

**类型说明**:
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**:
```bash
git add .
git commit -m "feat(teams): 添加团队邀请功能

- 实现邀请码生成和验证
- 添加团队成员管理界面
- 更新相关API接口

相关Issue: #45"
```

### 4. 推送和PR

```bash
git push origin feature/your-feature-name
```

然后在GitHub上创建Pull Request。

## 🗃️ 数据库变更规范

### 变更流程

1. **在开发环境测试**
   - 先在本地Supabase项目测试
   - 确保变更不会破坏现有功能

2. **创建迁移文件**
   ```
   db/migrations/V{下一个版本号}__{描述}.sql
   ```

3. **文件内容要求**:
   ```sql
   -- 迁移描述和目的
   -- 作者: Your Name
   -- 日期: YYYY-MM-DD
   -- 版本: V{版本号}
   
   -- 执行部分
   -- 你的SQL语句...
   
   -- 回退说明（注释形式）
   /*
   ROLLBACK INSTRUCTIONS:
   如果需要回退此迁移，请执行以下步骤：
   1. 具体回退SQL语句
   2. 验证步骤
   */
   ```

4. **更新文档**
   - 更新 `db/README.md` 中的迁移文件说明
   - 在 `docs/LESSONS_LEARNED.md` 记录重要变更

### 数据库变更检查清单

- [ ] 在开发环境充分测试
- [ ] 创建了正确命名的迁移文件
- [ ] 包含了回退说明
- [ ] 更新了相关文档
- [ ] 验证了RLS策略正确性
- [ ] 测试了前端功能正常

## 🎨 代码规范

### TypeScript/JavaScript

- 使用TypeScript进行类型安全
- 遵循ESLint配置
- 使用有意义的变量和函数名
- 添加JSDoc注释说明复杂逻辑

### React组件

- 使用函数组件和Hooks
- 组件名使用PascalCase
- Props接口定义清晰
- 合理拆分组件，保持单一职责

### 样式

- 使用Tailwind CSS
- 保持响应式设计
- 遵循现有的设计系统

### 示例代码

```typescript
/**
 * 团队邀请组件
 * 用于处理团队成员邀请功能
 */
interface TeamInviteProps {
  teamId: string;
  onInviteSuccess: (email: string) => void;
}

export function TeamInvite({ teamId, onInviteSuccess }: TeamInviteProps) {
  // 组件实现...
}
```

## 🧪 测试要求

### 单元测试

- 为新功能编写测试
- 测试覆盖率保持在80%以上
- 使用有意义的测试描述

### 集成测试

- 测试API接口功能
- 验证数据库操作正确性
- 测试用户权限和RLS策略

### 手动测试

- 在不同浏览器测试
- 验证响应式设计
- 测试错误处理和边界情况

## 📚 文档更新

### 何时更新文档

- 添加新功能时
- 修改API接口时
- 变更数据库结构时
- 修复重要Bug时

### 文档类型

- **README.md**: 项目概述和快速开始
- **API文档**: 接口说明和示例
- **数据库文档**: 表结构和关系说明
- **部署文档**: 生产环境部署指南

## 🐛 Bug报告

### 报告格式

```markdown
## Bug描述
简短描述问题

## 复现步骤
1. 第一步
2. 第二步
3. 看到错误

## 预期行为
应该发生什么

## 实际行为
实际发生了什么

## 环境信息
- 浏览器: Chrome 120
- 操作系统: Windows 11
- Node.js版本: 18.17.0

## 附加信息
- 错误截图
- 控制台错误信息
- 相关日志
```

## 💡 功能建议

### 建议格式

```markdown
## 功能描述
详细描述建议的功能

## 使用场景
什么情况下会用到这个功能

## 预期收益
这个功能能带来什么价值

## 实现思路
简单的实现想法（可选）
```

## 🔍 代码审查

### 审查要点

- **功能正确性**: 代码是否实现了预期功能
- **代码质量**: 是否遵循最佳实践
- **性能考虑**: 是否有性能问题
- **安全性**: 是否存在安全漏洞
- **可维护性**: 代码是否易于理解和维护

### 审查流程

1. 自我审查代码
2. 创建Pull Request
3. 等待团队成员审查
4. 根据反馈修改代码
5. 审查通过后合并

## 🚀 发布流程

### 版本管理

- 使用语义化版本号 (Semantic Versioning)
- 主版本号.次版本号.修订号
- 例如: 1.2.3

### 发布检查清单

- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 数据库迁移已测试
- [ ] 性能测试通过
- [ ] 安全审查完成

## 📞 获取帮助

### 联系方式

- **GitHub Issues**: 报告Bug和功能建议
- **Discussions**: 技术讨论和问答
- **文档**: 查看项目文档

### 常见问题

**Q: 如何设置开发环境？**
A: 参考README.md的快速开始指南

**Q: 数据库迁移失败怎么办？**
A: 查看 `docs/MIGRATION_EXECUTION_GUIDE.md`

**Q: 如何运行测试？**
A: 使用 `npm test` 命令

---

**感谢您的贡献！** 🎉

每一个贡献都让TodoList变得更好。如果您有任何问题或建议，请随时联系我们。