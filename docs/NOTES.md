# Development Notes & Troubleshooting

This document records important notes, common errors, and solutions encountered during the development of the todolist project.

## 1. Gemini CLI Code Copying

**Issue**:
When receiving code snippets from the Gemini CLI, especially SQL, be aware that the displayed formatting may include line numbers. Copying this text directly into an editor can cause syntax errors.

**Solution**:
Request the code to be provided in a plain text block without any formatting or numbering to ensure a clean copy-paste.

---

## 2. Supabase Row-Level Security (RLS) Policies

**Issue**:
When creating a new team, the application would fail with a generic "An unexpected error occurred." message. Debugging revealed the underlying error to be `new row violates row-level security policy for table "teams"`.

**Explanation**:
This error occurs because the server-side action attempts to read the `team` data immediately after inserting it. However, the RLS policy for `SELECT` on the `teams` table did not permit the user who just created the team to read it back. A similar issue can occur with inserting into the `team_members` table.

**Solution**:
Ensure the correct RLS policies are in place for the `teams` and `team_members` tables. The policies should allow a user to create a team, select the team they just created, and add themselves as a member.

**Required SQL Policies**:
```sql
-- Drop existing policies if they exist, to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team creator can select the team" ON public.teams;
DROP POLICY IF EXISTS "Team creator can add themselves as a member" ON public.team_members;

-- Policies for the "teams" table
-- Allow authenticated users to insert a new team.
CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );

-- Allow a user to select a team if they are the one who created it.
CREATE POLICY "Team creator can select the team"
  ON public.teams FOR SELECT
  USING ( auth.uid() = created_by );

-- Policies for the "team_members" table
-- Allow a user to be added to a team if they are the creator of that team.
CREATE POLICY "Team creator can add themselves as a member"
  ON public.team_members FOR INSERT
  WITH CHECK ( auth.uid() = user_id AND auth.uid() = (SELECT created_by FROM teams WHERE id = team_id) );
```

---

## 3. Unique Constraint Violation

**Issue**:
When creating a team with a name that already exists, the application redirects to an error page with the message: `Team name already exists. Please choose a different name.`

**Explanation**:
This is not a bug, but expected behavior. The `teams` table has a unique constraint on the `name` column to prevent duplicate team names. The server-side code correctly catches the PostgreSQL unique violation error (code `23505`) and provides a user-friendly error message.

**Solution**:
When testing or using the application, ensure that each new team has a unique name.

---

## 4. Supabase SQL Editor Session Context

**Issue**:
When testing RLS policies or database functions that rely on `auth.uid()` in the Supabase SQL Editor, `SELECT auth.uid();` often returns `null`, leading to unexpected query results or function behavior.

**Explanation**:
The Supabase SQL Editor session is independent of your application's authenticated session. By default, it does not have an authenticated user context. Therefore, functions like `auth.uid()` will return `null`, and RLS policies dependent on the user ID will prevent data access.

**Solution**:
To simulate an authenticated user session in the SQL Editor for testing purposes, execute the following SQL statements *before* running your test queries or functions:

```sql
SET role = 'authenticated';
SET "request.jwt.claims" = '{"sub": "YOUR_USER_ID_HERE"}'; -- Replace with the actual user's UUID
```

**Important Note**:
These `SET` statements must be executed in the *same query block* or *same session* as the queries you are testing, as the session context can be reset between executions.

---

## 5. PostgreSQL Function Return Type Mismatch

**Issue**:
Encountered `ERROR: 42804: structure of query does not match function result type` with `DETAIL: Returned type character varying(255) does not match expected type text in column X.` when calling a PostgreSQL function.

**Explanation**:
This error occurs when the data type of a column returned by a `SELECT` statement within a `RETURNS TABLE` function does not precisely match the data type declared in the function's `RETURNS TABLE` clause. PostgreSQL is strict about type matching in function signatures, even for seemingly compatible types like `character varying` and `text`.

**Solution**:
Ensure the data types in the `RETURNS TABLE` declaration exactly match the data types of the columns returned by the `SELECT` query within the function. If modifying an existing function's return type, you must first `DROP FUNCTION` and then `CREATE` the function again with the corrected signature.

**Example Fix (for `get_team_members` function)**:

```sql
-- First, drop the existing function
DROP FUNCTION IF EXISTS get_team_members(bigint);

-- Then, create the function with the corrected return type (e.g., character varying instead of text)
CREATE OR REPLACE FUNCTION get_team_members(p_team_id bigint)
RETURNS TABLE (user_id uuid, email character varying)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
  ) THEN
    RETURN QUERY
    SELECT u.id, u.email
    FROM auth.users u
    JOIN team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = p_team_id;
  END IF;
END;
$$;
```

---

## 6. `ReferenceError: alert is not defined` in Server Actions

**Issue**:
Calling `alert()` directly within a Next.js Server Action results in a `ReferenceError: alert is not defined`.

**Explanation**:
Server Actions execute on the server-side, where browser-specific global objects like `window` or `alert` are not available. These functions are client-side APIs.

**Solution**:
Move any client-side interactions (like displaying `alert` messages) into a `"use client"` component. The Server Action should return data (e.g., an object with `success` or `error` properties), and the client component should then handle this data to display UI feedback.

**Example Fix**:
- Create a separate `"use client"` component (e.g., `InviteMemberForm.tsx`).
- In this client component, import and call the Server Action.
- Handle the Server Action's return value within the client component to display `alert` or other UI elements.

---

## 7. Missing Imports in Server Actions

**Issue**:
After modifying a Server Action file, functions like `cookies` or `createClient` become undefined, leading to `ReferenceError`.

**Explanation**:
During modifications, especially with `replace` operations, import statements at the top of the file might be inadvertently removed or corrupted if the `old_string` and `new_string` do not precisely account for them.

**Solution**:
Always double-check the top of the file after any modification to ensure all necessary imports (`cookies`, `createClient`, `redirect`, `revalidatePath`, `isRedirectError`, etc.) are present and correct.

---

## 8. Persistent `page.tsx` Syntax Errors & `replace` Tool Limitations

**Issue**:
Repeated `Syntax Error: Unexpected token` in `page.tsx` files, often after using the `replace` tool, leading to a debugging loop.

**Explanation**:
The `replace` tool requires an *exact literal match* for `old_string`, including all whitespace, indentation, and newlines. Even minor discrepancies will cause it to fail (`0 occurrences found`). When dealing with complex JSX structures or when the file content might have subtly changed between reads, constructing a perfectly matching `old_string` becomes extremely difficult and error-prone.

**Solution**:
For complex file modifications, especially those involving JSX or large blocks of code where `replace` is unreliable, use the `write_file` tool to *completely overwrite* the target file with the corrected content. This ensures the file's syntax and structure are precisely as intended, bypassing the `replace` tool's strict matching requirements.

---

## 9. 错误处理系统重大升级 🚀 **COMPLETED**

### 最新更新 (2025-01-07)

**问题背景：**
用户对 `NEXT_REDIRECT` 错误信息不够详细感到沮丧，要求提供更具体的错误原因和解决方案。

**实施的改进：**

#### 1. 创建统一错误处理库 (`src/lib/error-handler.ts`)
- ✅ 详细错误日志记录功能
- ✅ 错误类型自动分类（认证、权限、数据库、网络等）
- ✅ 用户友好错误消息生成
- ✅ 基于错误类型的解决方案建议
- ✅ 开发者详细错误信息

#### 2. 增强错误显示组件 (`src/components/ErrorDisplay.tsx`)
- ✅ 智能错误类型识别和图标显示
- ✅ 可展开的详细错误信息
- ✅ 错误分类和解决方案显示
- ✅ 响应式设计和暗色主题支持
- ✅ 简化版错误显示组件

#### 3. 改进团队创建功能
- ✅ 更新 `actions.ts` 使用新的错误处理库
- ✅ 创建增强的客户端表单组件 (`src/components/TeamCreateForm.tsx`)
- ✅ 实时表单验证和用户反馈
- ✅ 提交状态显示和加载动画
- ✅ 字符计数和格式验证

#### 4. 用户体验优化
- ✅ 中文界面本地化
- ✅ 详细的错误分类和解决建议
- ✅ 实时验证反馈
- ✅ 加载状态指示
- ✅ 返回导航链接

**技术特性：**
- 🔍 错误类型自动分类：认证、权限、数据库、网络、验证、未知
- 💡 智能解决方案建议
- 📊 详细的错误日志记录
- 🎨 用户友好的错误界面
- ⚡ 实时表单验证
- 🌙 暗色主题支持

### 之前解决的问题

#### NEXT_REDIRECT 错误的诊断历程

**最终发现的问题：**
- `team_members` 表缺少 `joined_at` 列
- 错误代码：`42703` (column "joined_at" does not exist)
- 这导致团队创建过程中添加成员失败

**已解决的问题：**
- ✅ `base64url` 编码问题已修复
- ✅ `teams` 表的邀请码生成已更新为使用 MD5 哈希
- ✅ RLS 策略已重新创建
- ✅ 错误处理和用户体验大幅改进

**解决方案：**
执行 `fix-team-members-table.sql` 脚本来：
1. 添加缺失的 `joined_at` 列
2. 确保主键和外键约束
3. 为现有记录设置 `joined_at` 时间戳
4. 创建索引以提高查询性能
5. 启用 RLS 并创建相关策略

**team_members 表期望结构**:
```sql
CREATE TABLE team_members (
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
```