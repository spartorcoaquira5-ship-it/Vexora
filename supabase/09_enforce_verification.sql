-- =====================================================================
-- 09_enforce_verification.sql — "No puede vender si no está verificado"
-- debe cumplirse aunque alguien llame a la API directo, sin pasar por
-- el frontend. Antes solo lo bloqueaba la UI del prototipo.
-- =====================================================================
create or replace function fn_require_verified_provider()
returns trigger language plpgsql as $$
declare v_verified boolean;
begin
  select verified into v_verified from providers where id = new.provider_id;
  if not coalesce(v_verified, false) then
    raise exception 'Debes verificar tu identidad (DNI + extracto bancario) antes de poder vender.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_offers_require_verified on provider_offers;
create trigger trg_offers_require_verified before insert on provider_offers
  for each row execute function fn_require_verified_provider();

drop trigger if exists trg_units_require_verified on inventory_units;
create trigger trg_units_require_verified before insert on inventory_units
  for each row execute function fn_require_verified_provider();
