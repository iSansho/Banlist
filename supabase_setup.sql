-- Vytvorenie tabuľky trestov
create table punishments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  target_id text not null,
  target_name text not null,
  type text not null, -- WARN, BAN, WL-DOWN, SUSPEND
  reason text not null,
  details text,
  evidence_url text,
  expires_at timestamp with time zone,
  admin_discord_id text not null,
  admin_name text not null
);

-- Povolenie RLS (Row Level Security)
alter table punishments enable row level security;

-- Politika pre čítanie (všetci prihlásení používatelia môžu čítať)
create policy "Všetci môžu čítať tresty"
  on punishments for select
  using (true);

-- Politika pre vkladanie/úpravu/mazanie (iba admini - toto sa zvyčajne rieši cez Service Role alebo zložitejšie RLS, 
-- ale pre tento panel budeme kontrolovať whitelist priamo v aplikácii. 
-- Pre maximálnu bezpečnosť by ste mali pridať RLS kontrolu na discord_id.)
create policy "Admini môžu meniť dáta"
  on punishments for all
  using (auth.role() = 'authenticated');
