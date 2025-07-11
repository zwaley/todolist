-- 禁用 teams 表上所有依赖不存在函数的触发器，解决创建团队时报 42501 错误
DROP TRIGGER IF EXISTS auto_add_team_creator_trigger ON teams;
DROP TRIGGER IF EXISTS teams_set_invite_code_trigger ON teams;
DROP TRIGGER IF EXISTS trigger_auto_generate_invite_code ON teams;
-- 如需恢复功能，请补全相关函数后再重建触发器
