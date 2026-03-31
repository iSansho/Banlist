-- Aktualizácia funkcie is_admin pre lepšiu detekciu Discord ID a fallback na email majiteľa
create or replace function public.is_admin()
returns boolean as $$
declare
  _discord_id text;
  _email text;
begin
  -- Skúsime získať Discord ID z rôznych možných miest v JWT tokene
  _discord_id := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'provider_id',
    auth.jwt() -> 'user_metadata' ->> 'sub'
  );

  -- Ak sme nenašli ID v user_metadata, skúsime pozrieť do tabuľky identities
  if _discord_id is null then
    select id into _discord_id from auth.identities where user_id = auth.uid() limit 1;
  end if;

  -- Ak stále nemáme ID, skúsime použiť samotné auth.uid() (ak by bolo zhodné)
  if _discord_id is null then
    _discord_id := auth.uid()::text;
  end if;

  -- Získame email z tokenu pre fallback
  _email := auth.jwt() ->> 'email';

  -- Skontroluje, či je Discord ID prihláseného používateľa v tabuľke admins
  -- ALEBO či je to email majiteľa (Floutic@gmail.com)
  return exists (
    select 1 from public.admins 
    where discord_id = _discord_id
  ) or (_email = 'Floutic@gmail.com');
end;
$$ language plpgsql security definer;
