-- 1. Drop existing constraint
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_platform_check;

-- 2. Add updated constraint that includes 'google_workspace' along with existing platforms
ALTER TABLE integrations ADD CONSTRAINT integrations_platform_check 
    CHECK (platform IN ('slack', 'asana', 'google_calendar', 'google_workspace', 'jira', 'trello', 'github'));

-- 3. Perform the migration on the rows
UPDATE integrations SET platform = 'google_workspace' WHERE platform = 'google_calendar';
