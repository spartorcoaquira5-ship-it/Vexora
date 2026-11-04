-- =====================================================================
-- 03_functions.sql — Operaciones sensibles (SECURITY DEFINER)
-- Todas corren con permisos elevados pero validan rol/propiedad
-- manualmente y registran en audit_log. El frontend solo puede
-- invocarlas vía RPC; nunca escribe estas tablas directamente
-- (reforzado además por las policies de 02_rls_policies.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- HELPER: registrar auditoría
-- ---------------------------------------------------------------------
create or replace function log_audit(
  p_user_id uuid, p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(user_id, action, entity, entity_id, metadata)
  values (p_user_id, p_action, p_entity, p_entity_id, p_metadata);
end;
$$;

-- ---------------------------------------------------------------------
-- HELPER: notificar
-- ---------------------------------------------------------------------
create or replace function notify_user(
  p_user_id uuid, p_type notification_type, p_title text, p_message text,
  p_related_entity text default null, p_related_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, type, title, message, related_entity, related_id)
  values (p_user_id, p_type, p_title, p_message, p_related_entity, p_related_id);
end;
$$;

-- =====================================================================
-- RECARGAS
-- =====================================================================

-- Cliente crea la solicitud (también posible por INSERT directo bajo RLS;
-- se expone como función para centralizar validaciones)
create or replace function fn_create_recharge(p_amount numeric, p_proof_url text, p_reference text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_amount <= 0 then raise exception 'Monto inválido'; end if;
  insert into recharges(client_id, amount, proof_url, reference, status)
  values (auth.uid(), p_amount, p_proof_url, p_reference, 'pendiente')
  returning id into v_id;

  perform log_audit(auth.uid(), 'crear_recarga', 'recharges', v_id, jsonb_build_object('amount', p_amount));
  return v_id;
end;
$$;

-- Admin confirma: acredita saldo, deja todo trazado
create or replace function fn_confirm_recharge(p_recharge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_recharge recharges%rowtype;
  v_new_balance numeric;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;

  select * into v_recharge from recharges where id = p_recharge_id for update;
  if not found then raise exception 'Recarga no encontrada'; end if;
  if v_recharge.status <> 'pendiente' then raise exception 'La recarga ya fue procesada'; end if;

  update profiles set wallet_balance = wallet_balance + v_recharge.amount
    where id = v_recharge.client_id
    returning wallet_balance into v_new_balance;

  insert into wallet_movements(client_id, type, amount, balance_after, related_recharge_id, description)
  values (v_recharge.client_id, 'recarga', v_recharge.amount, v_new_balance, p_recharge_id, 'Recarga confirmada');

  update recharges set status = 'confirmada', admin_id = auth.uid(), confirmed_at = now()
    where id = p_recharge_id;

  perform log_audit(auth.uid(), 'confirmar_recarga', 'recharges', p_recharge_id,
    jsonb_build_object('amount', v_recharge.amount, 'client_id', v_recharge.client_id));
  perform notify_user(v_recharge.client_id, 'recarga', 'Recarga confirmada',
    'Tu recarga de S/' || v_recharge.amount || ' fue acreditada.', 'recharges', p_recharge_id);
end;
$$;

create or replace function fn_reject_recharge(p_recharge_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_recharge recharges%rowtype;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  select * into v_recharge from recharges where id = p_recharge_id for update;
  if not found then raise exception 'Recarga no encontrada'; end if;
  if v_recharge.status <> 'pendiente' then raise exception 'La recarga ya fue procesada'; end if;

  update recharges set status = 'rechazada', admin_id = auth.uid(), confirmed_at = now()
    where id = p_recharge_id;

  perform log_audit(auth.uid(), 'rechazar_recarga', 'recharges', p_recharge_id, jsonb_build_object('reason', p_reason));
  perform notify_user(v_recharge.client_id, 'recarga', 'Recarga rechazada',
    coalesce('Tu recarga fue rechazada: ' || p_reason, 'Tu recarga fue rechazada.'), 'recharges', p_recharge_id);
end;
$$;

-- =====================================================================
-- COMPRA (núcleo transaccional del marketplace)
-- =====================================================================
create or replace function fn_purchase_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_offer        provider_offers%rowtype;
  v_unit         inventory_units%rowtype;
  v_client_balance numeric;
  v_commission   numeric;
  v_provider_amt numeric;
  v_order_id     uuid;
  v_expires_at   timestamptz;
  v_duration_days int;
  v_retention_days int;
  v_retention_release_at timestamptz;
begin
  if current_role_safe() <> 'cliente' then raise exception 'Solo un cliente puede comprar'; end if;

  select * into v_offer from provider_offers where id = p_offer_id and status = 'activo' for update;
  if not found then raise exception 'Oferta no disponible'; end if;

  -- bloquear al cliente para evitar condiciones de carrera sobre el saldo
  select wallet_balance into v_client_balance from profiles where id = auth.uid() for update;
  if v_client_balance < v_offer.price then raise exception 'Saldo insuficiente'; end if;

  -- reservar exactamente una unidad disponible (evita doble venta con SKIP LOCKED)
  select * into v_unit from inventory_units
    where offer_id = p_offer_id and status = 'disponible'
    order by created_at asc
    for update skip locked
    limit 1;
  if not found then raise exception 'Sin stock disponible'; end if;

  -- calcular comisión
  if v_offer.commission_type = 'porcentaje' then
    v_commission := round(v_offer.price * v_offer.commission_value / 100.0, 2);
  else
    v_commission := v_offer.commission_value;
  end if;
  if v_commission > v_offer.price then v_commission := v_offer.price; end if;
  v_provider_amt := v_offer.price - v_commission;

  select days into v_duration_days from product_durations where id = v_offer.duration_id;
  v_expires_at := now() + (v_duration_days || ' days')::interval;

  -- snapshot del período de retención vigente del proveedor (no cambia si luego se reconfigura)
  select retention_days into v_retention_days from providers where id = v_offer.provider_id;
  v_retention_release_at := now() + (v_retention_days || ' days')::interval;

  -- debitar saldo del cliente
  update profiles set wallet_balance = wallet_balance - v_offer.price where id = auth.uid();
  insert into wallet_movements(client_id, type, amount, balance_after, description)
  values (auth.uid(), 'compra', -v_offer.price,
          (select wallet_balance from profiles where id = auth.uid()), 'Compra de oferta');

  -- crear pedido con desglose financiero explícito (monto_cliente/comisión/monto_proveedor/
  -- monto_retenido/fecha_inicio_retención/fecha_liberación/estado_financiero)
  insert into orders(client_id, offer_id, provider_id, product_id, duration_id,
                      inventory_unit_id, price, commission_amount, provider_amount,
                      held_amount, retention_days_snapshot, retention_starts_at,
                      retention_release_at, financial_status, status)
  values (auth.uid(), p_offer_id, v_offer.provider_id, v_offer.product_id, v_offer.duration_id,
          v_unit.id, v_offer.price, v_commission, v_provider_amt,
          v_provider_amt, v_retention_days, now(),
          v_retention_release_at, 'retenido', 'completado')
  returning id into v_order_id;

  -- asignar la unidad de inventario exacta
  update inventory_units set
    status = 'asignado', order_id = v_order_id, client_id = auth.uid(),
    assigned_at = now(), expires_at = v_expires_at
  where id = v_unit.id;

  -- vincular movimiento de wallet con el pedido
  -- (Postgres no permite ORDER BY/LIMIT directo en UPDATE, por eso la subconsulta)
  update wallet_movements set related_order_id = v_order_id
    where id = (
      select id from wallet_movements
      where client_id = auth.uid() and related_order_id is null and related_recharge_id is null
      order by created_at desc limit 1
    );

  -- acreditar al proveedor como RETENIDO (libera tras periodo de retención, ver fn_release_expired_retentions)
  insert into provider_movements(provider_id, type, retenido_delta, order_id, description)
  values (v_offer.provider_id, 'venta', v_provider_amt, v_order_id, 'Venta - fondos retenidos');

  update providers set sales_count = sales_count + 1 where id = v_offer.provider_id;

  perform log_audit(auth.uid(), 'compra', 'orders', v_order_id,
    jsonb_build_object('offer_id', p_offer_id, 'price', v_offer.price, 'provider_amount', v_provider_amt));
  perform notify_user(v_offer.provider_id, 'venta', 'Nueva venta', 'Se realizó una venta de tu oferta.', 'orders', v_order_id);

  return v_order_id;
end;
$$;

-- =====================================================================
-- LIBERACIÓN DE RETENCIÓN
-- Primera versión: SIN scheduler externo ni pg_cron. Se invoca:
--   a) manualmente por el Admin desde el panel ("Liberar retenciones vencidas"), y/o
--   b) de forma oportunista al cargar el dashboard del proveedor / del admin
--      (el frontend puede llamarla en background sin que el usuario lo note).
-- Cuando el proyecto lo requiera, se agenda con el scheduler disponible en el
-- proyecto Supabase (pg_cron si el plan lo permite) sin tocar esta función.
--
-- IDEMPOTENCIA: cada pedido solo se libera si sigue en financial_status='retenido'.
-- El SELECT ... FOR UPDATE SKIP LOCKED evita que dos ejecuciones concurrentes
-- (dos admins, o una llamada manual solapada con la agendada) liberen el mismo
-- pedido dos veces: si una transacción ya tomó el lock de una fila, la otra
-- simplemente la salta en vez de esperar y duplicar el movimiento.
-- =====================================================================
create or replace function fn_release_expired_retentions()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_provider_id uuid;
  v_held_amount numeric;
  v_count int := 0;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;

  for v_order_id, v_provider_id, v_held_amount in
    select o.id, o.provider_id, o.held_amount
    from orders o
    where o.financial_status = 'retenido'
      and o.retention_release_at <= now()
      and not exists (
        select 1 from claims c
        where c.order_id = o.id and c.status in ('abierto','en_revision')
      )
    order by o.retention_release_at asc
    for update of o skip locked
  loop
    -- doble chequeo dentro del lock: si otra transacción ya la liberó
    -- entre el SELECT y este punto, se ignora (defensa adicional).
    update orders set financial_status = 'liberado'
      where id = v_order_id and financial_status = 'retenido';
    if not found then
      continue;
    end if;

    insert into provider_movements(provider_id, type, retenido_delta, disponible_delta, order_id, description)
    values (v_provider_id, 'liberacion_retenido', -v_held_amount, v_held_amount,
            v_order_id, 'Liberación tras periodo de retención');

    perform notify_user(v_provider_id, 'saldo_disponible', 'Saldo disponible',
      'S/' || v_held_amount || ' de tu venta ya están disponibles.', 'orders', v_order_id);
    perform log_audit(auth.uid(), 'liberar_retencion', 'orders', v_order_id,
      jsonb_build_object('provider_id', v_provider_id, 'amount', v_held_amount));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- =====================================================================
-- RETIROS
-- =====================================================================
create or replace function fn_request_withdrawal(p_amount numeric, p_method_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_disponible numeric;
  v_id uuid;
begin
  if current_role_safe() <> 'proveedor' then raise exception 'No autorizado'; end if;

  select disponible into v_disponible from provider_balances where provider_id = auth.uid();
  if v_disponible is null or v_disponible < p_amount then raise exception 'Saldo disponible insuficiente'; end if;

  if not exists (select 1 from withdrawal_methods where id = p_method_id and provider_id = auth.uid()) then
    raise exception 'Método de retiro inválido';
  end if;

  insert into withdrawals(provider_id, amount, method_id, status)
  values (auth.uid(), p_amount, p_method_id, 'pendiente')
  returning id into v_id;

  insert into provider_movements(provider_id, type, disponible_delta, reservado_delta, withdrawal_id, description)
  values (auth.uid(), 'reserva_retiro', -p_amount, p_amount, v_id, 'Solicitud de retiro');

  perform log_audit(auth.uid(), 'solicitar_retiro', 'withdrawals', v_id, jsonb_build_object('amount', p_amount));
  return v_id;
end;
$$;

create or replace function fn_approve_withdrawal(p_withdrawal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  update withdrawals set status = 'aprobado', admin_id = auth.uid()
    where id = p_withdrawal_id and status = 'pendiente';
  if not found then raise exception 'Retiro no encontrado o ya procesado'; end if;
  perform log_audit(auth.uid(), 'aprobar_retiro', 'withdrawals', p_withdrawal_id, '{}');
end;
$$;

create or replace function fn_reject_withdrawal(p_withdrawal_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_w withdrawals%rowtype;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  select * into v_w from withdrawals where id = p_withdrawal_id for update;
  if not found or v_w.status not in ('pendiente','aprobado') then
    raise exception 'Retiro no encontrado o no se puede rechazar';
  end if;

  update withdrawals set status = 'rechazado', admin_id = auth.uid(), rejection_reason = p_reason
    where id = p_withdrawal_id;

  insert into provider_movements(provider_id, type, reservado_delta, disponible_delta, withdrawal_id, description)
  values (v_w.provider_id, 'retiro_rechazado', -v_w.amount, v_w.amount, p_withdrawal_id, 'Retiro rechazado');

  perform log_audit(auth.uid(), 'rechazar_retiro', 'withdrawals', p_withdrawal_id, jsonb_build_object('reason', p_reason));
  perform notify_user(v_w.provider_id, 'retiro', 'Retiro rechazado',
    coalesce('Tu retiro fue rechazado: ' || p_reason, 'Tu retiro fue rechazado.'), 'withdrawals', p_withdrawal_id);
end;
$$;

-- Admin marca que ya pagó manualmente y genera código único de canje
create or replace function fn_mark_withdrawal_paid(p_withdrawal_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_w withdrawals%rowtype;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  select * into v_w from withdrawals where id = p_withdrawal_id for update;
  if not found or v_w.status <> 'aprobado' then raise exception 'El retiro debe estar aprobado'; end if;

  -- código legible tipo 8K4P-29XM
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4)) || '-' ||
            upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 4));

  update withdrawals set
    status = 'codigo_generado', paid_at = now(),
    code = v_code, code_expires_at = now() + interval '7 days'
  where id = p_withdrawal_id;

  perform log_audit(auth.uid(), 'generar_codigo_retiro', 'withdrawals', p_withdrawal_id, '{}');
  perform notify_user(v_w.provider_id, 'retiro', 'Retiro pagado',
    'Tu retiro fue pagado. Ingresa tu código en "Canjear retiro".', 'withdrawals', p_withdrawal_id);
  return v_code;
end;
$$;

-- Proveedor canjea el código
create or replace function fn_redeem_withdrawal_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_w withdrawals%rowtype;
begin
  if current_role_safe() <> 'proveedor' then raise exception 'No autorizado'; end if;

  select * into v_w from withdrawals
    where code = p_code and provider_id = auth.uid() for update;
  if not found then raise exception 'Código inválido'; end if;
  if v_w.status <> 'codigo_generado' then raise exception 'Código ya utilizado o no disponible'; end if;
  if v_w.code_expires_at < now() then raise exception 'Código expirado'; end if;

  update withdrawals set
    status = 'completado', code_redeemed_at = now()
  where id = v_w.id;

  insert into provider_movements(provider_id, type, reservado_delta, retirado_delta, withdrawal_id, description)
  values (v_w.provider_id, 'retiro_completado', -v_w.amount, v_w.amount, v_w.id, 'Retiro canjeado y completado');

  perform log_audit(auth.uid(), 'canjear_retiro', 'withdrawals', v_w.id, '{}');
end;
$$;

-- =====================================================================
-- RECLAMOS
-- =====================================================================
create or replace function fn_resolve_claim(
  p_claim_id uuid, p_resolution_type claim_resolution_type, p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_claim claims%rowtype;
  v_order orders%rowtype;
  v_new_balance numeric;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;

  select * into v_claim from claims where id = p_claim_id for update;
  if not found then raise exception 'Reclamo no encontrado'; end if;
  if v_claim.status = 'resuelto' then raise exception 'Reclamo ya resuelto'; end if;

  select * into v_order from orders where id = v_claim.order_id for update;

  if p_resolution_type = 'reembolso_cliente' then
    if v_order.financial_status = 'reembolsado' then raise exception 'Este pedido ya fue reembolsado'; end if;

    update profiles set wallet_balance = wallet_balance + v_order.price
      where id = v_claim.client_id returning wallet_balance into v_new_balance;
    insert into wallet_movements(client_id, type, amount, balance_after, related_order_id, description)
    values (v_claim.client_id, 'reembolso', v_order.price, v_new_balance, v_order.id, 'Reembolso por reclamo');
    update orders set status = 'reembolsado', financial_status = 'reembolsado' where id = v_order.id;
    -- se revierte lo retenido al proveedor por esta venta (solo si aún seguía retenido;
    -- si ya se había liberado a disponible, se descuenta de disponible en su lugar)
    if v_order.financial_status = 'retenido' then
      insert into provider_movements(provider_id, type, retenido_delta, order_id, claim_id, description)
      values (v_claim.provider_id, 'ajuste_reclamo', -v_order.held_amount, v_order.id, p_claim_id, 'Reversión por reembolso (fondos retenidos)');
    else
      insert into provider_movements(provider_id, type, disponible_delta, order_id, claim_id, description)
      values (v_claim.provider_id, 'ajuste_reclamo', -v_order.held_amount, v_order.id, p_claim_id, 'Reversión por reembolso (fondos ya disponibles)');
    end if;

  elsif p_resolution_type = 'liberar_proveedor' then
    if v_order.financial_status = 'retenido' then
      insert into provider_movements(provider_id, type, retenido_delta, disponible_delta, order_id, claim_id, description)
      values (v_claim.provider_id, 'liberacion_retenido', -v_order.held_amount, v_order.held_amount,
              v_order.id, p_claim_id, 'Liberación tras resolución de reclamo');
      update orders set financial_status = 'liberado' where id = v_order.id;
    end if;
    -- si ya estaba 'liberado', no hay nada que mover: el dinero ya está disponible.

  end if; -- 'reemplazo' y 'otro' no mueven dinero automáticamente; requieren gestión manual

  update claims set
    status = 'resuelto', resolution_type = p_resolution_type, resolution_notes = p_notes,
    admin_id = auth.uid(), resolved_at = now()
  where id = p_claim_id;

  perform log_audit(auth.uid(), 'resolver_reclamo', 'claims', p_claim_id,
    jsonb_build_object('resolution_type', p_resolution_type));
  perform notify_user(v_claim.client_id, 'reclamo', 'Reclamo resuelto', 'Tu reclamo fue resuelto.', 'claims', p_claim_id);
  perform notify_user(v_claim.provider_id, 'reclamo', 'Reclamo resuelto', 'Un reclamo sobre tu venta fue resuelto.', 'claims', p_claim_id);
end;
$$;

-- =====================================================================
-- REPUTACIÓN: recalcular cache tras cada review nueva
-- =====================================================================
create or replace function fn_recalc_provider_rating(p_provider_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update providers p set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from reviews where provider_id = p_provider_id), 0),
    rating_count = (select count(*) from reviews where provider_id = p_provider_id)
  where p.id = p_provider_id;
end;
$$;

create or replace function fn_submit_review(p_order_id uuid, p_rating int, p_comment text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_id uuid;
begin
  select * into v_order from orders where id = p_order_id and client_id = auth.uid();
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_order.status <> 'completado' then raise exception 'Solo se puede valorar un pedido completado'; end if;

  insert into reviews(order_id, client_id, provider_id, product_id, rating, comment)
  values (p_order_id, auth.uid(), v_order.provider_id, v_order.product_id, p_rating, p_comment)
  returning id into v_id;

  perform fn_recalc_provider_rating(v_order.provider_id);
  perform notify_user(v_order.provider_id, 'sistema', 'Nueva valoración', 'Recibiste una nueva valoración.', 'reviews', v_id);
  return v_id;
end;
$$;

-- =====================================================================
-- ACCESO A CREDENCIALES DE INVENTARIO (secret_ref / credentials_encrypted)
--
-- El SELECT directo de estas columnas está revocado para el rol
-- "authenticated" (ver 02_rls_policies.sql). Estas funciones son el único
-- camino para leerlas, y cada una aplica sus propias reglas de negocio.
-- Nota sobre cifrado: secret_ref/credentials_encrypted deben contener el
-- resultado de cifrar la credencial real (no la credencial en texto
-- plano) antes de insertarse — recomendado hacerlo en una Edge Function
-- con pgsodium/Vault de Supabase, nunca en el cliente. Estas funciones
-- devuelven ese valor tal como está guardado; si se usa Vault, en su
-- lugar devolverían el resultado de vault.decrypted_secrets.
-- =====================================================================

-- Cliente: leer la credencial de SU pedido, solo si sigue vigente.
create or replace function fn_get_inventory_credentials(p_order_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_unit inventory_units%rowtype;
begin
  select * into v_order from orders where id = p_order_id and client_id = auth.uid();
  if not found then raise exception 'Pedido no encontrado'; end if;

  -- una vez reembolsado, el cliente pierde acceso: el producto ya no le pertenece
  if v_order.financial_status = 'reembolsado' or v_order.status = 'reembolsado' then
    raise exception 'Este pedido fue reembolsado; la credencial ya no está disponible';
  end if;

  select * into v_unit from inventory_units where id = v_order.inventory_unit_id;
  if not found or v_unit.status not in ('asignado') then
    raise exception 'La credencial no está disponible actualmente';
  end if;

  perform log_audit(auth.uid(), 'ver_credencial', 'orders', p_order_id, '{}');
  return v_unit.secret_ref;
end;
$$;

-- Proveedor: leer/editar el secreto de SU PROPIA unidad, solo mientras
-- sigue sin vender (una vez asignada a un pedido, ni el proveedor puede
-- volver a leerla para evitar manipulación post-venta; en disputas, el
-- Admin puede consultarla igualmente).
create or replace function fn_get_own_inventory_secret(p_unit_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_unit inventory_units%rowtype;
begin
  select * into v_unit from inventory_units where id = p_unit_id;
  if not found then raise exception 'Unidad no encontrada'; end if;

  if is_admin() then
    return v_unit.secret_ref;
  end if;

  if current_role_safe() <> 'proveedor' or v_unit.provider_id <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  if v_unit.status <> 'disponible' then
    raise exception 'La unidad ya fue vendida; no se puede consultar por esta vía';
  end if;

  return v_unit.secret_ref;
end;
$$;

-- Proveedor/Admin: leer las credenciales de una cuenta contenedora propia.
create or replace function fn_get_own_account_credentials(p_account_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_account inventory_accounts%rowtype;
begin
  select * into v_account from inventory_accounts where id = p_account_id;
  if not found then raise exception 'Cuenta de inventario no encontrada'; end if;
  if not (is_admin() or (current_role_safe() = 'proveedor' and v_account.provider_id = auth.uid())) then
    raise exception 'No autorizado';
  end if;
  return v_account.credentials_encrypted;
end;
$$;

-- =====================================================================
-- TRIGGERS DE PROTECCIÓN DE CAMPOS INMUTABLES
-- (más confiables que una subconsulta autorreferencial en RLS WITH CHECK)
-- =====================================================================
create or replace function fn_protect_review_fields()
returns trigger language plpgsql as $$
begin
  if current_role_safe() <> 'admin' then
    new.rating := old.rating;
    new.comment := old.comment;
    new.client_id := old.client_id;
    new.order_id := old.order_id;
    new.provider_id := old.provider_id;
    new.product_id := old.product_id;
    if new.provider_reply is distinct from old.provider_reply then
      new.provider_reply_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_reviews_protect before update on reviews
  for each row execute function fn_protect_review_fields();

create or replace function fn_protect_notification_fields()
returns trigger language plpgsql as $$
begin
  if current_role_safe() <> 'admin' then
    new.title := old.title;
    new.message := old.message;
    new.type := old.type;
    new.user_id := old.user_id;
    new.related_entity := old.related_entity;
    new.related_id := old.related_id;
    -- solo "read" queda libre para que el propio usuario la marque
  end if;
  return new;
end;
$$;
create trigger trg_notifications_protect before update on notifications
  for each row execute function fn_protect_notification_fields();

-- =====================================================================
-- AUDITORÍA AUTOMÁTICA DE CONFIGURACIÓN / CATÁLOGO
-- Cubre las tablas donde Admin (y, para ofertas, el proveedor) escribe
-- directamente vía RLS sin pasar por un RPC dedicado: creación/edición
-- de productos, duraciones, categorías, ofertas y configuración de
-- plataforma. El resto de acciones administrativas (confirmar recargas,
-- aprobar/rechazar retiros, generar/canjear códigos, reembolsar, resolver
-- reclamos, suspender proveedores) ya quedan registradas explícitamente
-- dentro de cada función de 03_functions.sql.
-- =====================================================================
create or replace function fn_audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entity_id uuid;
  v_action text;
begin
  v_action := lower(TG_OP) || '_' || TG_TABLE_NAME;
  v_entity_id := case when TG_OP = 'DELETE' then old.id else new.id end;

  perform log_audit(
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_build_object(
      'old', case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_categories after insert or update or delete on categories
  for each row execute function fn_audit_row_change();
create trigger trg_audit_products after insert or update or delete on products
  for each row execute function fn_audit_row_change();
create trigger trg_audit_durations after insert or update or delete on product_durations
  for each row execute function fn_audit_row_change();
create trigger trg_audit_offers after insert or update or delete on provider_offers
  for each row execute function fn_audit_row_change();
create trigger trg_audit_settings after insert or update or delete on platform_settings
  for each row execute function fn_audit_row_change();

-- =====================================================================
-- SUSPENSIÓN DE PROVEEDORES (no borra dinero, solo cambia estado)
-- =====================================================================
create or replace function fn_set_provider_status(p_provider_id uuid, p_status provider_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  update providers set status = p_status where id = p_provider_id;
  if p_status in ('suspendido','bloqueado') then
    update provider_offers set status = 'pausado' where provider_id = p_provider_id and status = 'activo';
  end if;
  perform log_audit(auth.uid(), 'cambiar_estado_proveedor', 'providers', p_provider_id,
    jsonb_build_object('status', p_status));
  perform notify_user(p_provider_id, 'sistema', 'Estado de cuenta actualizado',
    'Tu estado como proveedor cambió a: ' || p_status, 'providers', p_provider_id);
end;
$$;
