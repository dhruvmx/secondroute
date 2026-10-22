ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS longitude double precision;
CREATE UNIQUE INDEX IF NOT EXISTS membership_user_unique ON memberships(user_id);
