-- =====================================================================
-- 05_rls_updates.sql — RLS para lo nuevo: cupones y verificación de
-- proveedores. Requiere 02_rls_policies.sql ya corrido (usa is_admin(),
-- current_role_safe()).
-- =====================================================================

-- ---------------------------------------------------------------------
-- CUPONES
-- Nadie puede listar todos los cupones salvo Admin (evita que cualquiera
-- vea/filtre códigos ajenos). El cliente valida un código puntual a
-- través de fn_purchase_offer (SECURITY DEFINER, ver 06_functions_updates.sql),
-- nunca leyendo la tabla directo.
-- ---------------------------------------------------------------------
alter table coupons enable row level security;

create policy coupons_select_admin on coupons for select
  using (is_admin());
create policy coupons_write_admin on coupons for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- VERIFICACIÓN DE PROVEEDORES: proteger las columnas de estado/revisión
-- ante un UPDATE normal del propio proveedor (que sí puede editar bio,
-- foto, etc. vía la policy providers_update_self ya existente). Solo
-- fn_submit_provider_verification y fn_review_provider_verification
-- (SECURITY DEFINER, corren fuera de RLS) pueden cambiar estos campos.
-- ---------------------------------------------------------------------
create or replace function fn_protect_verification_fields()
returns trigger language plpgsql as $$
begin
  if current_role_safe() <> 'admin' then
    new.verification_status := old.verification_status;
    new.verification_note := old.verification_note;
    new.dni_proof_path := old.dni_proof_path;
    new.bank_statement_proof_path := old.bank_statement_proof_path;
    new.verification_submitted_at := old.verification_submitted_at;
    new.verification_reviewed_by := old.verification_reviewed_by;
    new.verification_reviewed_at := old.verification_reviewed_at;
    new.verified := old.verified;
  end if;
  return new;
end;
$$;
create trigger trg_providers_protect_verification before update on providers
  for each row execute function fn_protect_verification_fields();
