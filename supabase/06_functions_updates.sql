-- =====================================================================
-- 06_functions_updates.sql — Verificación de proveedores, cupones, y
-- fn_purchase_offer actualizada para aceptar un cupón opcional.
-- Requiere 03_functions.sql ya corrido (usa log_audit(), notify_user(),
-- current_role_safe(), is_admin()).
-- =====================================================================

-- =====================================================================
-- VERIFICACIÓN DE IDENTIDAD DEL PROVEEDOR
-- =====================================================================

-- El proveedor envía (o reenvía tras un rechazo) sus documentos.
-- Los paths deben ser rutas dentro del bucket privado "verificacion"
-- (ej. '<uid>/dni.jpg'), subidas antes desde el cliente directamente a
-- Storage — esta función solo registra las rutas, no mueve archivos.
create or replace function fn_submit_provider_verification(p_dni_path text, p_bank_path text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status provider_verification_status;
begin
  if current_role_safe() <> 'proveedor' then raise exception 'No autorizado'; end if;
  if p_dni_path is null or p_bank_path is null then
    raise exception 'Debes adjuntar tu DNI y tu extracto bancario.';
  end if;

  select verification_status into v_status from providers where id = auth.uid() for update;
  if v_status = 'pendiente' then raise exception 'Ya tienes una verificación en revisión.'; end if;
  if v_status = 'aprobada' then raise exception 'Tu cuenta ya está verificada.'; end if;

  update providers set
    dni_proof_path = p_dni_path,
    bank_statement_proof_path = p_bank_path,
    verification_status = 'pendiente',
    verification_note = null,
    verification_submitted_at = now()
  where id = auth.uid();

  perform log_audit(auth.uid(), 'enviar_verificacion', 'providers', auth.uid(), '{}');
  perform notify_user(p.id, 'sistema', 'Nueva verificación pendiente',
    'Un proveedor envió documentos para verificación.', 'providers', auth.uid())
  from profiles p where p.role = 'admin';
end;
$$;

-- Admin aprueba o rechaza. Aprobar es lo único que activa providers.verified.
create or replace function fn_review_provider_verification(p_provider_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_status provider_verification_status;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;

  select verification_status into v_status from providers where id = p_provider_id for update;
  if v_status is distinct from 'pendiente' then
    raise exception 'Este proveedor no tiene una verificación pendiente de revisión.';
  end if;

  if p_approve then
    update providers set
      verified = true, verification_status = 'aprobada', verification_note = null,
      verification_reviewed_by = auth.uid(), verification_reviewed_at = now()
    where id = p_provider_id;
    perform notify_user(p_provider_id, 'sistema', 'Verificación aprobada',
      '¡Tu cuenta fue verificada! Tus documentos fueron aprobados y ya puedes vender.', 'providers', p_provider_id);
  else
    update providers set
      verified = false, verification_status = 'rechazada', verification_note = p_note,
      verification_reviewed_by = auth.uid(), verification_reviewed_at = now()
    where id = p_provider_id;
    perform notify_user(p_provider_id, 'sistema',
      'Verificación rechazada', coalesce('Tu verificación fue rechazada: ' || p_note,
      'Tu verificación fue rechazada.') || ' Puedes volver a enviar tus documentos.', 'providers', p_provider_id);
  end if;

  perform log_audit(auth.uid(), 'revisar_verificacion', 'providers', p_provider_id,
    jsonb_build_object('approved', p_approve, 'note', p_note));
end;
$$;

-- =====================================================================
-- CUPONES DE DESCUENTO
-- =====================================================================
create or replace function fn_create_coupon(
  p_code text, p_type commission_type, p_value numeric, p_max_uses int, p_product_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  if p_value <= 0 or p_max_uses < 1 then raise exception 'Valor o usos máximos inválidos'; end if;

  insert into coupons(code, type, value, max_uses, product_id, created_by)
  values (upper(trim(p_code)), p_type, p_value, p_max_uses, p_product_id, auth.uid())
  returning id into v_id;

  perform log_audit(auth.uid(), 'crear_cupon', 'coupons', v_id,
    jsonb_build_object('code', p_code, 'type', p_type, 'value', p_value));
  return v_id;
end;
$$;

-- Admin "regala" un cupón a un cliente puntual (le llega como notificación).
create or replace function fn_send_coupon_to_client(p_coupon_id uuid, p_client_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_c coupons%rowtype;
begin
  if current_role_safe() <> 'admin' then raise exception 'No autorizado'; end if;
  select * into v_c from coupons where id = p_coupon_id and active;
  if not found then raise exception 'Cupón no encontrado o inactivo'; end if;

  perform notify_user(p_client_id, 'sistema',
    '¡Ganaste un cupón!',
    'Usa el código ' || v_c.code || ' (' ||
      (case when v_c.type = 'porcentaje' then v_c.value || '% de descuento' else 'S/' || v_c.value || ' de descuento' end) ||
      ') en tu próxima compra.', 'coupons', p_coupon_id);
  perform log_audit(auth.uid(), 'enviar_cupon', 'coupons', p_coupon_id, jsonb_build_object('client_id', p_client_id));
end;
$$;

-- =====================================================================
-- COMPRA CON CUPÓN OPCIONAL (reemplaza la fn_purchase_offer de 03_functions.sql)
-- IMPORTANTE: agregar un parámetro nuevo NO reemplaza la función original
-- con "create or replace" — Postgres la trataría como una sobrecarga
-- distinta, y luego "fn_purchase_offer(un_uuid)" quedaría ambiguo entre
-- las dos firmas. Por eso primero se elimina la versión de un solo
-- parámetro antes de crear la nueva.
-- =====================================================================
drop function if exists fn_purchase_offer(uuid);

create or replace function fn_purchase_offer(p_offer_id uuid, p_coupon_code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_offer        provider_offers%rowtype;
  v_unit         inventory_units%rowtype;
  v_coupon       coupons%rowtype;
  v_client_balance numeric;
  v_commission   numeric;
  v_provider_amt numeric;
  v_order_id     uuid;
  v_expires_at   timestamptz;
  v_duration_days int;
  v_retention_days int;
  v_retention_release_at timestamptz;
  v_final_price  numeric;
  v_discount     numeric := 0;
begin
  if current_role_safe() <> 'cliente' then raise exception 'Solo un cliente puede comprar'; end if;

  select * into v_offer from provider_offers where id = p_offer_id and status = 'activo' for update;
  if not found then raise exception 'Oferta no disponible'; end if;

  -- validar y aplicar cupón, si se pasó uno
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from coupons
      where code = upper(trim(p_coupon_code)) and active and uses < max_uses
      for update;
    if not found then raise exception 'Cupón inválido, vencido o sin usos disponibles'; end if;
    if v_coupon.product_id is not null and v_coupon.product_id <> v_offer.product_id then
      raise exception 'Este cupón no aplica a este producto';
    end if;
    v_discount := case when v_coupon.type = 'porcentaje'
      then round(v_offer.price * v_coupon.value / 100.0, 2)
      else v_coupon.value
    end;
    if v_discount > v_offer.price then v_discount := v_offer.price; end if;
  end if;
  v_final_price := v_offer.price - v_discount;

  select wallet_balance into v_client_balance from profiles where id = auth.uid() for update;
  if v_client_balance < v_final_price then raise exception 'Saldo insuficiente'; end if;

  select * into v_unit from inventory_units
    where offer_id = p_offer_id and status = 'disponible'
    order by created_at asc
    for update skip locked
    limit 1;
  if not found then raise exception 'Sin stock disponible'; end if;

  if v_offer.commission_type = 'porcentaje' then
    v_commission := round(v_final_price * v_offer.commission_value / 100.0, 2);
  else
    v_commission := v_offer.commission_value;
  end if;
  if v_commission > v_final_price then v_commission := v_final_price; end if;
  v_provider_amt := v_final_price - v_commission;

  select days into v_duration_days from product_durations where id = v_offer.duration_id;
  v_expires_at := now() + (v_duration_days || ' days')::interval;

  select retention_days into v_retention_days from providers where id = v_offer.provider_id;
  v_retention_release_at := now() + (v_retention_days || ' days')::interval;

  update profiles set wallet_balance = wallet_balance - v_final_price where id = auth.uid();
  insert into wallet_movements(client_id, type, amount, balance_after, description)
  values (auth.uid(), 'compra', -v_final_price,
          (select wallet_balance from profiles where id = auth.uid()),
          'Compra de oferta' || (case when v_discount > 0 then ' (cupón ' || v_coupon.code || ')' else '' end));

  insert into orders(client_id, offer_id, provider_id, product_id, duration_id,
                      inventory_unit_id, price, commission_amount, provider_amount,
                      held_amount, retention_days_snapshot, retention_starts_at,
                      retention_release_at, financial_status, status, coupon_id, discount_amount)
  values (auth.uid(), p_offer_id, v_offer.provider_id, v_offer.product_id, v_offer.duration_id,
          v_unit.id, v_final_price, v_commission, v_provider_amt,
          v_provider_amt, v_retention_days, now(),
          v_retention_release_at, 'retenido', 'completado',
          case when v_discount > 0 then v_coupon.id else null end, v_discount)
  returning id into v_order_id;

  update inventory_units set
    status = 'asignado', order_id = v_order_id, client_id = auth.uid(),
    assigned_at = now(), expires_at = v_expires_at
  where id = v_unit.id;

  -- (Postgres no permite ORDER BY/LIMIT directo en UPDATE, por eso la subconsulta)
  update wallet_movements set related_order_id = v_order_id
    where id = (
      select id from wallet_movements
      where client_id = auth.uid() and related_order_id is null and related_recharge_id is null
      order by created_at desc limit 1
    );

  insert into provider_movements(provider_id, type, retenido_delta, order_id, description)
  values (v_offer.provider_id, 'venta', v_provider_amt, v_order_id, 'Venta - fondos retenidos');

  update providers set sales_count = sales_count + 1 where id = v_offer.provider_id;

  if v_discount > 0 then
    update coupons set uses = uses + 1 where id = v_coupon.id;
  end if;

  perform log_audit(auth.uid(), 'compra', 'orders', v_order_id,
    jsonb_build_object('offer_id', p_offer_id, 'price', v_final_price, 'discount', v_discount, 'provider_amount', v_provider_amt));
  perform notify_user(v_offer.provider_id, 'venta', 'Nueva venta', 'Se realizó una venta de tu oferta.', 'orders', v_order_id);

  return v_order_id;
end;
$$;
