-- KROK 1: Priprava stĺpca
ALTER TABLE punishments RENAME COLUMN proof_url TO proof_url_old;
ALTER TABLE punishments ADD COLUMN proof_url JSONB DEFAULT '[]'::jsonb;

-- KROK 2: Bezpečný update prázdnych hodnôt
UPDATE punishments SET proof_url = '[]'::jsonb WHERE proof_url_old IS NULL OR proof_url_old = '';

-- KROK 3: Bezpečný update textových liniek do poľa
UPDATE punishments SET proof_url = jsonb_build_array(proof_url_old::text) WHERE proof_url_old IS NOT NULL AND proof_url_old != '';

-- KROK 4: Zmazanie starého stĺpca
ALTER TABLE punishments DROP COLUMN proof_url_old;

-- KROK 5: Pridanie media_urls do Agendy (meetings)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb;
