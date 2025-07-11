## 数据库当前状态全面描述报告 (基于用户提供的信息)

**更新日期：2025年7月11日**

以下是您当前数据库中 `public` 模式下 `teams`, `team_members`, `todos` 三张核心表的详细信息：

#### **1. 表结构 (Table Schemas)**

| table_name   | column_name  | data_type                | is_nullable | column_default                    |
| :----------- | :----------- | :----------------------- | :---------- | :-------------------------------- |
| team_members | team_id      | uuid                     | NO          | null                              |
| team_members | user_id      | uuid                     | NO          | null                              |
| team_members | created_at   | timestamp with time zone | NO          | now()                             |
| team_members | joined_at    | timestamp with time zone | YES         | now()                             |
| teams        | id           | uuid                     | NO          | gen_random_uuid()                 |
| teams        | name         | text                     | NO          | null                              |
| teams        | description  | text                     | YES         | null                              |
| teams        | created_by   | uuid                     | NO          | null                              |
| teams        | created_at   | timestamp with time zone | NO          | now()                             |
| teams        | updated_at   | timestamp with time zone | NO          | now()                             |
| teams        | invite_code  | text                     | YES         | null                              |
| todos        | id           | integer                  | NO          | nextval('todos_id_seq'::regclass) |
| todos        | task         | text                     | NO          | null                              |
| todos        | is_completed | boolean                  | NO          | false                             |
| todos        | team_id      | uuid                     | YES         | null                              |
| todos        | user_id      | uuid                     | NO          | null                              |
| todos        | created_at   | timestamp with time zone | NO          | now()                             |
| todos        | updated_at   | timestamp with time zone | NO          | now()                             |

**说明**：
*   `teams.id`、`team_members.team_id`、`team_members.user_id`、`todos.team_id`、`teams.created_by` 和 `todos.user_id` 都是 `uuid` 类型。
*   `teams.id` 默认通过 `gen_random_uuid()` 生成。
*   `todos.id` 是序列生成的整数。
*   `created_at` 和 `updated_at` 字段默认使用 `now()`。

#### **2. 约束与关系 (Constraints and Relationships)**

| constraint_name           | table_name   | constraint_type | constraint_definition                                                |
| :------------------------ | :----------- | :-------------- | :------------------------------------------------------------------- |
| team_members_team_id_fkey | team_members | FOREIGN KEY     | FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE         |
| team_members_user_id_fkey | team_members | FOREIGN KEY     | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE    |
| team_members_pkey         | team_members | PRIMARY KEY     | PRIMARY KEY (team_id, user_id)                                       |
| unique_team_member        | team_members | UNIQUE          | UNIQUE (team_id, user_id)                                            |
| team_description_length   | teams        | UNKNOWN         | CHECK ((length(description) <= 500))                                 |
| team_name_length          | teams        | UNKNOWN         | CHECK (((length(name) >= 1) AND (length(name) <= 100)))              |
| teams_created_by_fkey     | teams        | FOREIGN KEY     | FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE |
| teams_pkey                | teams        | PRIMARY KEY     | PRIMARY KEY (id)                                                     |
| task_length               | todos        | UNKNOWN         | CHECK (((length(task) >= 1) AND (length(task) <= 500)))              |
| todos_team_id_fkey        | todos        | FOREIGN KEY     | FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE         |
| todos_user_id_fkey        | todos        | FOREIGN KEY     | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE    |
| todos_pkey                | todos        | PRIMARY KEY     | PRIMARY KEY (id)                                                     |

**说明**：
*   定义了所有表的主键 (`PRIMARY KEY`)。
*   定义了表之间的外键 (`FOREIGN KEY`) 关系，确保数据完整性，例如 `team_members` 关联 `teams` 和 `auth.users`。
*   存在 `UNIQUE` 约束 (`unique_team_member`) 确保 `team_id` 和 `user_id` 组合的唯一性。
*   存在 `CHECK` 约束，限制了 `name`, `description`, `task` 字段的长度。

#### **3. 行级安全策略 (RLS Policies)**

| tablename    | policyname                                              | command | using_expression                                                                                        | with_check_expression     |
| :----------- | :------------------------------------------------------ | :------ | :------------------------------------------------------------------------------------------------------ | :------------------------ |
| team_members | Team Members: Owners can delete their team members      | DELETE  | is_team_owner(team_id)                                                                                  | null                      |
| team_members | Team Members: Owners can manage their team members      | UPDATE  | is_team_owner(team_id)                                                                                  | is_team_owner(team_id)    |
| team_members | Team Members: Users can be added                        | INSERT  | null                                                                                                    | true                      |
| team_members | Team Members: Users can leave their own teams           | DELETE  | (user_id = auth.uid())                                                                                  | null                      |
| team_members | Team Members: Users can see their own membership record | SELECT  | (user_id = auth.uid())                                                                                  | null                      |
| teams        | Teams: Authenticated users can create their own teams   | INSERT  | null                                                                                                    | (created_by = auth.uid()) |
| teams        | Teams: Owners can delete their teams                    | DELETE  | is_team_owner(id)                                                                                       | null                      |
| teams        | Teams: Owners can update their teams                    | UPDATE  | is_team_owner(id)                                                                                       | is_team_owner(id)         |
| teams        | Teams: Users can view teams they are members of         | SELECT  | (id IN ( SELECT team_members.team_id FROM team_members WHERE (team_members.user_id = auth.uid()))) | null                      |
| todos        | Todos: Users can manage their own todos                 | ALL     | (user_id = auth.uid())                                                                                  | (user_id = auth.uid())    |

**说明**：
*   `teams` 表的 `INSERT` 策略 (`Teams: Authenticated users can create their own teams`) 允许认证用户创建团队，但 `WITH CHECK (created_by = auth.uid())` 评估的是即将插入的行，这可能是导致 `42501` 错误的关键点。
*   `teams` 表的 `SELECT` 策略 (`Teams: Users can view teams they are members of`) 允许用户查看他们是成员的团队。
*   `team_members` 表的 `SELECT` 策略 (`Team Members: Users can see their own membership record`) 允许用户只看到自己的成员记录，这避免了无限递归。
*   `is_team_owner(id)` 函数被用于 `UPDATE` 和 `DELETE` 策略中，以检查用户是否是团队所有者。

#### **4. 触发器 (Triggers)**

| table_name | trigger_name                      | trigger_event | trigger_timing | trigger_function                             |
| :--------- | :-------------------------------- | :------------ | :------------- | :------------------------------------------- |
| teams      | auto_add_team_creator_trigger     | INSERT        | AFTER          | EXECUTE FUNCTION auto_add_team_creator()     |
| teams      | teams_set_invite_code_trigger     | INSERT        | BEFORE         | EXECUTE FUNCTION set_invite_code()           |
| teams      | trigger_auto_generate_invite_code | INSERT        | BEFORE         | EXECUTE FUNCTION auto_generate_invite_code() |
| teams      | update_teams_updated_at           | UPDATE        | BEFORE         | EXECUTE FUNCTION update_updated_at_column()  |
| todos      | update_todos_updated_at           | UPDATE        | BEFORE         | EXECUTE FUNCTION update_updated_at_column()  |

**说明**：
*   `teams` 表有多个 `BEFORE INSERT` 触发器，用于设置邀请码和自动生成邀请码。
*   `teams` 表有一个 `AFTER INSERT` 触发器 `auto_add_team_creator_trigger`，用于自动添加创建者为团队成员。
*   `teams` 和 `todos` 表都有 `BEFORE UPDATE` 触发器，用于更新 `updated_at` 字段。

#### **5. 函数定义 (Function Definitions)**

**根据您之前提供的查询结果，`public` 模式下没有找到任何由上述触发器调用的函数定义。**

**说明**：
*   这意味着，尽管触发器被定义了，但它们所依赖的函数（例如 `auto_add_team_creator()`, `set_invite_code()`, `auto_generate_invite_code()`, `update_updated_at_column()`）在数据库中是**不存在**的。
*   当触发器尝试调用这些不存在的函数时，会导致 `INSERT` 或 `UPDATE` 操作失败，这很可能是您反复遇到的 `42501` 错误（`new row violates row-level security policy`）的根本原因，因为它阻止了操作在RLS评估之前完成。

---

**总结与下一步**

这份报告全面描述了您数据库的当前状态。最关键的发现是：**触发器所依赖的函数不存在**。这导致了 `INSERT` 操作在RLS评估之前就被阻止，从而产生了误导性的 `42501` 错误。

**下一步的行动计划将基于这个核心发现：**

1.  **禁用所有依赖于不存在函数的触发器**：这是解决 `42501` 错误的关键。
2.  **重新应用我们最新、最正确的RLS策略**：确保在触发器问题解决后，RLS策略能够正确地工作。

我将再次提供这些SQL命令。请您务必按照顺序执行。
