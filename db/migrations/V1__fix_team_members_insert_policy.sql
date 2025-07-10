ALTER POLICY team_members_policy_insert ON public.team_members
WITH CHECK (
    (user_id = auth.uid()) OR (team_id IN (SELECT id FROM teams WHERE created_by = auth.uid()))
);