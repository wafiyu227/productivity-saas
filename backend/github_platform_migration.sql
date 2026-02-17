-- Drop the existing check constraint if it exists
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_platform_check;

-- Add the new check constraint with correct platform names
-- NOTE: 'google_calendar' is used in the DB, not 'google'
ALTER TABLE integrations ADD CONSTRAINT integrations_platform_check 
    CHECK (platform IN ('slack', 'asana', 'google_calendar', 'jira', 'trello', 'github'));
