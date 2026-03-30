-- Vytvorenie tabuľky trestov (Banlist)
create table if not exists punishments (
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
create table if not exists wanted (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  discord_id text,
  discord_username text,
  description text not null,
  danger_level text not null,
  status text default 'ACTIVE',
  whitelist_status text default 'NONE',
  admin_name text not null
);

-- Vytvorenie tabuľky Bugs (Nahlásené chyby)
create table if not exists bugs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  title text not null,
  description text not null,
  priority text not null,
  status text default 'OPEN',
  reporter_name text not null
);

-- Vytvorenie tabuľky Meetings (Schôdzky/Porady)
create table if not exists meetings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  title text not null,
  description text,
  scheduled_at timestamp with time zone not null,
  location text,
  organizer_name text not null
);

-- Vytvorenie tabuľky Logs (Audit logy)
create table if not exists logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  admin_name text not null,
  admin_discord_id text not null,
  action text not null,
  target_name text,
  details text
);

-- Vytvorenie tabuľky Admins
create table if not exists admins (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  discord_id text not null unique,
  username text not null,
  added_by text not null
);

-- Vytvorenie tabuľky Punishment Reasons
create table if not exists punishment_reasons (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  label text not null unique
);

-- Povolenie RLS pre všetky tabuľky
alter table punishments enable row level security;
alter table wanted enable row level security;
alter table bugs enable row level security;
alter table meetings enable row level security;
alter table logs enable row level security;
alter table admins enable row level security;
alter table punishment_reasons enable row level security;

-- Odstránenie starých nebezpečných politík (ak existujú)
drop policy if exists "Všetci môžu čítať tresty" on punishments;
drop policy if exists "Všetci môžu čítať wanted" on wanted;
drop policy if exists "Všetci môžu čítať bugs" on bugs;
drop policy if exists "Všetci môžu čítať meetings" on meetings;
drop policy if exists "Iba admini môžu čítať logy" on logs;
drop policy if exists "Admini môžu meniť tresty" on punishments;
drop policy if exists "Admini môžu meniť wanted" on wanted;
drop policy if exists "Admini môžu meniť bugs" on bugs;
drop policy if exists "Admini môžu meniť meetings" on meetings;
drop policy if exists "Systém môže zapisovať logy" on logs;

-- Odstránenie nových politík (pre prípad, že sa skript spúšťa viackrát)
drop policy if exists "Admini môžu čítať a zapisovať tresty" on punishments;
drop policy if exists "Admini môžu čítať a zapisovať wanted" on wanted;
drop policy if exists "Admini môžu čítať a zapisovať bugs" on bugs;
drop policy if exists "Admini môžu čítať a zapisovať meetings" on meetings;
drop policy if exists "Admini môžu čítať a zapisovať logy" on logs;
drop policy if exists "Admini môžu čítať a zapisovať admins" on admins;
drop policy if exists "Admini môžu čítať a zapisovať punishment_reasons" on punishment_reasons;
drop policy if exists "Všetci prihlásení môžu čítať admins" on admins;

-- Vytvorenie funkcie na overenie admina
create or replace function public.is_admin()
returns boolean as $$
begin
  -- Skontroluje, či je provider_id (Discord ID) prihláseného používateľa v tabuľke admins
  return exists (
    select 1 from public.admins 
    where discord_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')
  );
end;
$$ language plpgsql security definer;

-- Nové bezpečné politiky (Iba admini môžu čítať a zapisovať)
create policy "Admini môžu čítať a zapisovať tresty" on punishments for all using (public.is_admin());
create policy "Admini môžu čítať a zapisovať wanted" on wanted for all using (public.is_admin());
create policy "Admini môžu čítať a zapisovať bugs" on bugs for all using (public.is_admin());
create policy "Admini môžu čítať a zapisovať meetings" on meetings for all using (public.is_admin());
create policy "Admini môžu čítať a zapisovať logy" on logs for all using (public.is_admin());
create policy "Admini môžu čítať a zapisovať admins" on admins for all using (public.is_admin());
create policy "Admini môžu čítať a zapisovať punishment_reasons" on punishment_reasons for all using (public.is_admin());

-- Umožnenie čítania tabuľky admins aj pre ne-adminov, aby sa vedeli overiť pri prvom prihlásení
create policy "Všetci prihlásení môžu čítať admins" on admins for select using (auth.role() = 'authenticated');
