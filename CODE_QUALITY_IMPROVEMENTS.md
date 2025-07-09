# 代码质量和可维护性改进建议

## 📋 当前项目状态评估

### ✅ 已完成的优秀实践
- **完整的错误处理**：邀请功能具有详细的错误分类和用户友好提示
- **安全的数据库设计**：RLS策略正确实施，避免了无限递归问题
- **模块化架构**：清晰的文件结构和组件分离
- **类型安全**：使用 TypeScript 提供类型检查
- **环境配置**：正确的环境变量管理

### 🔧 需要改进的领域

## 1. 数据库层面改进

### 1.1 数据库函数优化
```sql
-- 当前函数可以添加更好的错误处理和日志记录
CREATE OR REPLACE FUNCTION get_user_id_by_email(email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id_result text;
    function_name text := 'get_user_id_by_email';
BEGIN
    -- 添加输入验证
    IF email IS NULL OR email = '' THEN
        RAISE LOG 'Function %: Invalid email parameter', function_name;
        RETURN NULL;
    END IF;
    
    -- 验证邮箱格式
    IF email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE LOG 'Function %: Invalid email format: %', function_name, email;
        RETURN NULL;
    END IF;
    
    SELECT id INTO user_id_result
    FROM auth.users
    WHERE auth.users.email = get_user_id_by_email.email
    AND email_confirmed_at IS NOT NULL
    LIMIT 1;
    
    -- 记录查询结果
    IF user_id_result IS NOT NULL THEN
        RAISE LOG 'Function %: Found user for email: %', function_name, email;
    ELSE
        RAISE LOG 'Function %: No user found for email: %', function_name, email;
    END IF;
    
    RETURN user_id_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Function %: Error occurred: %', function_name, SQLERRM;
        RETURN NULL;
END;
$$;
```

### 1.2 数据库索引优化
```sql
-- 为常用查询添加复合索引
CREATE INDEX IF NOT EXISTS idx_team_members_team_user 
    ON team_members(team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_auth_users_email_confirmed 
    ON auth.users(email) 
    WHERE email_confirmed_at IS NOT NULL;

-- 为用户资料表添加全文搜索索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_search 
    ON user_profiles USING gin(to_tsvector('english', 
        COALESCE(username, '') || ' ' || COALESCE(display_name, '')));
```

## 2. 前端代码改进

### 2.1 类型安全增强
```typescript
// 创建严格的类型定义
// src/types/invite.ts
export interface InviteRequest {
  identifier: string;
  type: 'email' | 'username';
}

export interface InviteResponse {
  success: boolean;
  message: string;
  errorCode?: string;
}

export interface InviteError {
  code: string;
  message: string;
  details?: string;
}

// 使用联合类型确保错误处理的完整性
export type InviteErrorCode = 
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'USER_NOT_FOUND'
  | 'ALREADY_MEMBER'
  | 'CANNOT_INVITE_SELF'
  | 'DATABASE_ERROR';
```

### 2.2 错误处理标准化
```typescript
// src/lib/error-handler.ts
export class InviteError extends Error {
  constructor(
    public code: InviteErrorCode,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = 'InviteError';
  }
}

export function parseInviteError(error: unknown): InviteError {
  if (error instanceof InviteError) {
    return error;
  }
  
  if (typeof error === 'string' && error.includes('|')) {
    const [code, message] = error.split('|', 2);
    return new InviteError(code as InviteErrorCode, message);
  }
  
  return new InviteError('DATABASE_ERROR', '未知错误，请稍后重试');
}
```

### 2.3 组件性能优化
```typescript
// 使用 React.memo 和 useMemo 优化性能
import React, { memo, useMemo, useCallback } from 'react';

interface EnhancedInviteFormProps {
  teamId: string;
  onInviteSuccess?: (message: string) => void;
  onInviteError?: (error: InviteError) => void;
}

export const EnhancedInviteForm = memo<EnhancedInviteFormProps>(({ 
  teamId, 
  onInviteSuccess, 
  onInviteError 
}) => {
  // 使用 useCallback 避免不必要的重渲染
  const handleSubmit = useCallback(async (formData: FormData) => {
    try {
      const result = await inviteMember(teamId, formData);
      onInviteSuccess?.(result.message);
    } catch (error) {
      const inviteError = parseInviteError(error);
      onInviteError?.(inviteError);
    }
  }, [teamId, onInviteSuccess, onInviteError]);
  
  // 使用 useMemo 缓存计算结果
  const validationRules = useMemo(() => ({
    email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    username: /^[a-zA-Z0-9_]{3,20}$/
  }), []);
  
  // 组件实现...
});
```

## 3. 安全性增强

### 3.1 输入验证和清理
```typescript
// src/lib/validation.ts
import DOMPurify from 'dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input.trim());
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

export function validateTeamId(teamId: string): boolean {
  return /^\d+$/.test(teamId) && parseInt(teamId) > 0;
}
```

### 3.2 速率限制
```typescript
// src/lib/rate-limiter.ts
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

class RateLimiter {
  private attempts = new Map<string, number[]>();
  
  constructor(private config: RateLimitConfig) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];
    
    // 清理过期的尝试记录
    const validAttempts = userAttempts.filter(
      timestamp => now - timestamp < this.config.windowMs
    );
    
    if (validAttempts.length >= this.config.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);
    return true;
  }
}

export const inviteRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 60000 // 1分钟
});
```

## 4. 测试覆盖

### 4.1 单元测试示例
```typescript
// __tests__/invite.test.ts
import { describe, it, expect, vi } from 'vitest';
import { inviteMember } from '../src/app/teams/[id]/actions';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js');

describe('inviteMember', () => {
  it('should successfully invite user by email', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: 'user-id', error: null }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })
    };
    
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
    
    const formData = new FormData();
    formData.append('identifier', 'test@example.com');
    
    const result = await inviteMember('1', formData);
    expect(result.success).toBe(true);
  });
  
  it('should handle user not found error', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
    
    const formData = new FormData();
    formData.append('identifier', 'nonexistent@example.com');
    
    await expect(inviteMember('1', formData))
      .rejects.toThrow('USER_NOT_FOUND|用户不存在');
  });
});
```

### 4.2 集成测试
```typescript
// __tests__/integration/invite-flow.test.ts
import { test, expect } from '@playwright/test';

test.describe('邀请功能集成测试', () => {
  test('完整的邀请流程', async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // 进入团队页面
    await page.goto('/teams/1');
    
    // 邀请用户
    await page.fill('[name="identifier"]', 'newuser@example.com');
    await page.click('button:has-text("发送邀请")');
    
    // 验证成功消息
    await expect(page.locator('.success-message'))
      .toContainText('邀请发送成功');
  });
});
```

## 5. 性能监控

### 5.1 数据库查询监控
```sql
-- 创建查询性能监控视图
CREATE OR REPLACE VIEW invite_performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('teams', 'team_members', 'user_profiles')
ORDER BY tablename, attname;

-- 监控慢查询
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%team_members%' 
ORDER BY mean_time DESC;
```

### 5.2 前端性能监控
```typescript
// src/lib/performance.ts
export class PerformanceMonitor {
  static measureInviteAction(action: string) {
    return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
      const method = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        const start = performance.now();
        
        try {
          const result = await method.apply(this, args);
          const duration = performance.now() - start;
          
          // 记录性能指标
          console.log(`${action} completed in ${duration.toFixed(2)}ms`);
          
          // 发送到分析服务
          if (duration > 1000) {
            console.warn(`Slow ${action}: ${duration.toFixed(2)}ms`);
          }
          
          return result;
        } catch (error) {
          const duration = performance.now() - start;
          console.error(`${action} failed after ${duration.toFixed(2)}ms:`, error);
          throw error;
        }
      };
    };
  }
}
```

## 6. 文档和维护

### 6.1 API 文档
```typescript
/**
 * 邀请用户加入团队
 * 
 * @param teamId - 团队ID
 * @param formData - 包含邀请信息的表单数据
 * @param formData.identifier - 用户邮箱或用户名
 * 
 * @returns Promise<InviteResponse> 邀请结果
 * 
 * @throws {InviteError} 当邀请失败时抛出错误
 * 
 * @example
 * ```typescript
 * const formData = new FormData();
 * formData.append('identifier', 'user@example.com');
 * 
 * try {
 *   const result = await inviteMember('123', formData);
 *   console.log(result.message);
 * } catch (error) {
 *   if (error instanceof InviteError) {
 *     console.error(`邀请失败: ${error.message}`);
 *   }
 * }
 * ```
 */
export async function inviteMember(
  teamId: string, 
  formData: FormData
): Promise<InviteResponse>
```

### 6.2 变更日志
```markdown
# CHANGELOG.md

## [1.2.0] - 2024-01-XX

### Added
- 邀请功能支持用户名和邮箱两种方式
- 详细的错误处理和用户友好提示
- 数据库函数性能优化
- 完整的类型安全支持

### Fixed
- RLS策略无限递归问题
- 邀请功能数据库函数缺失
- 错误处理不完善

### Security
- 增强输入验证和清理
- 实施速率限制
- 改进权限检查
```

## 7. 部署和运维

### 7.1 健康检查端点
```typescript
// src/app/api/health/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();
    
    // 检查数据库连接
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .limit(1);
    
    if (error) {
      return Response.json(
        { status: 'unhealthy', error: error.message },
        { status: 503 }
      );
    }
    
    // 检查关键函数
    const { error: funcError } = await supabase
      .rpc('get_user_id_by_email', { email: 'health@check.com' });
    
    if (funcError && !funcError.message.includes('does not exist')) {
      return Response.json(
        { status: 'degraded', warning: 'Some functions unavailable' },
        { status: 200 }
      );
    }
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## 8. 立即行动项

### 高优先级（本周完成）
1. ✅ 执行 `fix-missing-components.sql` 补充缺失组件
2. 🔧 实施输入验证和清理
3. 📝 添加关键函数的单元测试
4. 🔍 设置基本的错误监控

### 中优先级（本月完成）
1. 🚀 优化数据库查询性能
2. 🛡️ 实施速率限制
3. 📊 添加性能监控
4. 📚 完善API文档

### 低优先级（下个版本）
1. 🧪 完整的集成测试套件
2. 📈 高级分析和监控
3. 🔄 自动化部署流程
4. 🌐 国际化支持

---

**总结**：当前代码质量已经很好，主要需要补充缺失的数据库组件，然后逐步实施上述改进建议。重点关注安全性、性能和可维护性三个方面。