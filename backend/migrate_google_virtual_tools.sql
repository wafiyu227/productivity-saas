-- Add a metadata JSONB column to the integrations table to handle virtual sub-tool preferences
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
