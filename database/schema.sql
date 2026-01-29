-- Slack summaries table
CREATE TABLE IF NOT EXISTS slack_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    team_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    blockers JSONB DEFAULT '[]'::jsonb,
    key_topics JSONB DEFAULT '[]'::jsonb,
    message_count INTEGER DEFAULT 0,
    time_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    time_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_slack_summaries_team_id ON slack_summaries(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_summaries_created_at ON slack_summaries(created_at DESC);

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    team_id TEXT,
    team_name TEXT,
    workspace_id TEXT,
    workspace_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_user_platform ON integrations(user_id, platform);