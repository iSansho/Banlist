-- 1. Fix proof_url to JSONB securely
ALTER TABLE punishments RENAME COLUMN proof_url TO proof_url_old;
ALTER TABLE punishments ADD COLUMN proof_url JSONB DEFAULT '[]'::jsonb;
UPDATE punishments 
SET proof_url = CASE 
    WHEN proof_url_old IS NULL OR proof_url_old = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(proof_url_old)
END;
ALTER TABLE punishments DROP COLUMN proof_url_old;

-- 2. Ensure missing columns exist in punishments
ALTER TABLE punishments ADD COLUMN IF NOT EXISTS player_name TEXT;
ALTER TABLE punishments ADD COLUMN IF NOT EXISTS player_discord_id TEXT;
ALTER TABLE punishments ADD COLUMN IF NOT EXISTS admin_name TEXT;

-- 3. Agenda (Meetings) Refactoring
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT INTO system_settings (key, value) VALUES ('agenda_webhook', '') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS agenda_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  admin_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agenda_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('UP', 'DOWN')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agenda_id, admin_id)
);

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'LOW';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'OTHER';
