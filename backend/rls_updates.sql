-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_summaries ENABLE ROW LEVEL SECURITY;

-- TEAMS policies
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
CREATE POLICY "Users can view teams they are members of"
ON teams FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id::uuid = teams.id::uuid
        AND team_members.user_id::uuid = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can create teams" ON teams;
CREATE POLICY "Users can create teams"
ON teams FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners and admins can update team details" ON teams;
CREATE POLICY "Owners and admins can update team details"
ON teams FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id::uuid = teams.id::uuid
        AND team_members.user_id::uuid = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
);

-- TEAM_MEMBERS policies
DROP POLICY IF EXISTS "Members can view their teammates" ON team_members;
CREATE POLICY "Members can view their teammates"
ON team_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_members AS my_membership
        WHERE my_membership.team_id::uuid = team_members.team_id::uuid
        AND my_membership.user_id::uuid = auth.uid()
    )
);

DROP POLICY IF EXISTS "Owners and admins can manage members" ON team_members;
CREATE POLICY "Owners and admins can manage members"
ON team_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM team_members AS my_membership
        WHERE my_membership.team_id::uuid = team_members.team_id::uuid
        AND my_membership.user_id::uuid = auth.uid()
        AND my_membership.role IN ('owner', 'admin')
    )
);

-- INTEGRATIONS policies
DROP POLICY IF EXISTS "Members can view team integrations" ON integrations;
CREATE POLICY "Members can view team integrations"
ON integrations FOR SELECT
USING (
    (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id::uuid = integrations.team_id::uuid
        AND team_members.user_id::uuid = auth.uid()
    ))
    OR (team_id IS NULL AND user_id::uuid = auth.uid())
);

DROP POLICY IF EXISTS "Users can manage their own or their team's integrations" ON integrations;
CREATE POLICY "Users can manage their own or their team's integrations"
ON integrations FOR ALL
USING (
    user_id::uuid = auth.uid()
    OR (team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id::uuid = integrations.team_id::uuid
        AND team_members.user_id::uuid = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    ))
);

-- SLACK_SUMMARIES policies (Covers blockers since they are a column)
DROP POLICY IF EXISTS "Members can view team summaries" ON slack_summaries;
CREATE POLICY "Members can view team summaries"
ON slack_summaries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id::text = slack_summaries.team_id::text
        AND team_members.user_id::uuid = auth.uid()
    )
);

DROP POLICY IF EXISTS "System can insert summaries" ON slack_summaries;
CREATE POLICY "System can insert summaries"
ON slack_summaries FOR INSERT
WITH CHECK (true); -- Service role usually handles this, but adding for safety
