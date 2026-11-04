-- =====================================================================
-- 07_auth_signup.sql — Conecta Supabase Auth con nuestra tabla profiles.
-- Requiere 01-06 ya corridos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Al registrarse (auth.users), crear automáticamente la fila en profiles.
-- SIEMPRE como 'cliente' — nadie puede auto-asignarse otro rol al
-- registrarse, ni siquiera manipulando metadata del lado del cliente.
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, wallet_balance)
  values (
    new.id,
    'cliente',
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    0
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Convertirse en proveedor: acción explícita de negocio, nunca un
-- cambio de rol libre. Un cliente la llama una vez; después de eso ya
-- no puede volver a llamarla (evita crear múltiples filas en providers).
-- ---------------------------------------------------------------------
create or replace function fn_become_provider(p_business_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_safe() <> 'cliente' then
    raise exception 'Solo una cuenta de cliente puede convertirse en proveedor';
  end if;
  if p_business_name is null or length(trim(p_business_name)) = 0 then
    raise exception 'El nombre del negocio es obligatorio';
  end if;

  insert into providers (id, business_name) values (auth.uid(), trim(p_business_name));
  update profiles set role = 'proveedor' where id = auth.uid();

  perform log_audit(auth.uid(), 'convertirse_en_proveedor', 'providers', auth.uid(), '{}');
end;
$$;
