-- Vytvorenie tabuľky trestov (Banlist)
create table punishments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  discord_id text,
  discord_username text,
  type text not null,
  reason text not null,
  details text,
  evidence_url text,
  expires_at timestamp with time zone,
  admin_discord_id text not null,
  admin_name text not null
);

-- Vytvorenie tabuľky Wanted (Hľadané osoby)
create table wanted (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  discord_id text,
  discord_username text,
  description text not null,
  danger_level text not null, -- LOW, MEDIUM, HIGH, EXTREME
  status text default 'ACTIVE', -- ACTIVE, CAPTURED, DECEASED
  whitelist_status text default 'NONE', -- DENIED, ALLOWED, NONE
  admin_name text not null
);

-- Vytvorenie tabuľky Bugs (Nahlásené chyby)
create table bugs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  title text not null,
  description text not null,
  priority text not null, -- LOW, MEDIUM, HIGH
  status text default 'OPEN', -- OPEN, IN_PROGRESS, FIXED, CLOSED
  reporter_name text not null
);

-- Vytvorenie tabuľky Meetings (Schôdzky/Porady)
create table meetings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  title text not null,
  description text,
  scheduled_at timestamp with time zone not null,
  location text,
  organizer_name text not null
);

-- Vytvorenie tabuľky Logs (Audit logy)
create table logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  admin_name text not null,
  admin_discord_id text not null,
  action text not null, -- e.g., "CREATE_BAN", "DELETE_WANTED"
  target_name text,
  details text
);

-- Povolenie RLS pre všetky tabuľky
alter table punishments enable row level security;
alter table wanted enable row level security;
alter table bugs enable row level security;
alter table meetings enable row level security;
alter table logs enable row level security;

-- Politiky pre čítanie
create policy "Všetci môžu čítať tresty" on punishments for select using (true);
create policy "Všetci môžu čítať wanted" on wanted for select using (true);
create policy "Všetci môžu čítať bugs" on bugs for select using (true);
create policy "Všetci môžu čítať meetings" on meetings for select using (true);
create policy "Iba admini môžu čítať logy" on logs for select using (auth.role() = 'authenticated');

-- Politiky pre zápis (iba prihlásení)
create policy "Admini môžu meniť tresty" on punishments for all using (auth.role() = 'authenticated');
create policy "Admini môžu meniť wanted" on wanted for all using (auth.role() = 'authenticated');
create policy "Admini môžu meniť bugs" on bugs for all using (auth.role() = 'authenticated');
create policy "Admini môžu meniť meetings" on meetings for all using (auth.role() = 'authenticated');
create policy "Systém môže zapisovať logy" on logs for insert with check (auth.role() = 'authenticated');
