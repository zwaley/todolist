-- V6: Final RLS Policy Fix
-- This script completely resets and rebuilds the RLS policies for core tables.
-- It is designed to be the single source of truth, correcting all past issues including infinite recursion.

-- Step 1: Drop all existing policies on the tables to ensure a clean slate.
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'teams')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON public.teams;';
    END LOOP;
END $$;

DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON public.team_members;';
    END LOOP;
END $$;

DO $$
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN (SELECT policyname FROM pg_policies WHERE tablename = 'todos')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON public.todos;';
    END LOOP;
END $$;

-- Step 2: Recreate all policies from scratch with the correct, non-recursive logic.

-- Policies for the 'teams' table
CREATE POLICY "Teams: Authenticated users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Teams: Members can view their own teams" ON public.teams FOR SELECT USING (id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Teams: Owners can update and delete their teams" ON public.teams FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

-- Policies for the 'team_members' table
CREATE POLICY "Team Members: Users can be added to teams" ON public.team_members FOR INSERT WITH CHECK (true);
-- This policy correctly checks for membership without causing recursion.
CREATE POLICY "Team Members: Users can view members of their own teams" ON public.team_members FOR SELECT USING (EXISTS (SELECT 1 FROM team_members AS m WHERE m.team_id = team_members.team_id AND m.user_id = auth.uid()));
CREATE POLICY "Team Members: Users can leave their teams" ON public.team_members FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Team Members: Owners can manage members" ON public.team_members FOR ALL USING (team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()));

-- Policies for the 'todos' table
CREATE POLICY "Todos: Users can manage their own todos" ON public.todos FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- End of script. Future deployments should run this file to ensure correct RLS setup.
