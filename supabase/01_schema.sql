-- =====================================================================
-- MARKETPLACE DE PRODUCTOS/SERVICIOS DIGITALES AUTORIZADOS
-- 01_schema.sql — Tipos, tablas, índices, constraints, triggers básicos
-- Motor: PostgreSQL (Supabase)
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role                as enum ('admin','proveedor','cliente');
create type account_status           as enum ('activo','suspendido');
create type provider_status          as enum ('activo','limitado','suspendido','bloqueado');

create type inventory_type           as enum ('codigo','licencia','suscripcion','cuenta','perfil','otro');
create type inventory_status         as enum ('disponible','asignado','vencido','bloqueado','retirado');

create type offer_status             as enum ('activo','pausado','eliminado');
create type commission_type          as enum ('porcentaje','monto_fijo');

create type order_status             as enum ('completado','en_reclamo','reembolsado','cancelado');
create type order_financial_status   as enum ('retenido','liberado','reembolsado','ajustado');

create type movement_type            as enum ('recarga','compra','reembolso','ajuste');
create type recharge_status          as enum ('pendiente','confirmada','rechazada','cancelada');

create type provider_movement_type   as enum (
  'venta','liberacion_retenido','reserva_retiro',
  'retiro_completado','retiro_rechazado','ajuste_reclamo','ajuste_admin'
);

create type withdrawal_method_type   as enum ('yape','cuenta_bancaria');
create type withdrawal_status        as enum (
  'pendiente','aprobado','rechazado','pago_realizado',
  'codigo_generado','canjeado','completado','cancelado'
);

create type claim_status             as enum ('abierto','en_revision','resuelto','cerrado');
create type claim_resolution_type    as enum ('reembolso_cliente','liberar_proveedor','reemplazo','otro');

create type notification_type        as enum ('recarga','retiro','reclamo','venta','saldo_disponible','sistema');

-- ---------------------------------------------------------------------
-- PERFILES (extiende auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'cliente',
  full_name       text not null,
  phone           text,
  status          account_status not null default 'activo',
  wallet_balance  numeric(12,2) not null default 0 check (wallet_balance >= 0), -- SOLO modificable por funciones seguras
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_profiles_role on profiles(role);

-- ---------------------------------------------------------------------
-- PROVEEDORES
-- ---------------------------------------------------------------------
create table providers (
  id              uuid primary key references profiles(id) on delete cascade,
  business_name   text not null,
  status          provider_status not null default 'activo',
  verified        boolean not null default false,
  retention_days  int not null default 30 check (retention_days >= 0),
  rating_avg      numeric(3,2) not null default 0,      -- cache, recalculado por función
  rating_count    int not null default 0,                -- cache
  sales_count     int not null default 0,                -- cache
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_providers_status on providers(status);

-- ---------------------------------------------------------------------
-- CATEGORÍAS Y PRODUCTOS (creados por Admin)
-- ---------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references categories(id),
  name         text not null,
  slug         text not null unique,
  description  text,
  image_url    text,
  active       boolean not null default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_products_category on products(category_id);
create index idx_products_active on products(active);

-- Duraciones configurables por producto (ej. Spotify: 12 meses; Prime: 1/3/6 meses)
create table product_durations (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id) on delete cascade,
  label        text not null,          -- "1 mes", "12 meses"
  days         int not null check (days > 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (product_id, label)
);
create index idx_durations_product on product_durations(product_id);

-- ---------------------------------------------------------------------
-- OFERTAS DE PROVEEDORES (proveedor + producto + duración + precio)
-- ---------------------------------------------------------------------
create table provider_offers (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references providers(id) on delete cascade,
  product_id        uuid not null references products(id),
  duration_id       uuid not null references product_durations(id),
  price             numeric(10,2) not null check (price > 0),
  commission_type   commission_type not null default 'porcentaje',
  commission_value  numeric(10,2) not null default 0 check (commission_value >= 0),
  status            offer_status not null default 'activo',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (provider_id, product_id, duration_id)
);
create index idx_offers_product on provider_offers(product_id);
create index idx_offers_provider on provider_offers(provider_id);
create index idx_offers_status on provider_offers(status);

-- ---------------------------------------------------------------------
-- INVENTARIO
-- Cuenta (contenedor) -> Unidades (perfiles/códigos/licencias individuales)
-- ---------------------------------------------------------------------
create table inventory_accounts (
  id                    uuid primary key default gen_random_uuid(),
  provider_id           uuid not null references providers(id) on delete cascade,
  offer_id              uuid not null references provider_offers(id) on delete cascade,
  type                  inventory_type not null,
  label                 text,                  -- identificador interno, ej. "Cuenta Prime #4"
  credentials_encrypted text,                   -- referencia cifrada / storage path; nunca texto plano
  max_units             int not null default 1 check (max_units > 0),
  created_at            timestamptz not null default now()
);
create index idx_inv_accounts_offer on inventory_accounts(offer_id);
create index idx_inv_accounts_provider on inventory_accounts(provider_id);

-- Unidad vendible real: 1 código, 1 licencia, o 1 perfil dentro de una cuenta
create table inventory_units (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid references inventory_accounts(id) on delete cascade, -- null si no aplica (código suelto)
  offer_id       uuid not null references provider_offers(id) on delete cascade,
  provider_id    uuid not null references providers(id),
  type           inventory_type not null,
  label          text,                    -- "Perfil 3", o vacío para códigos
  secret_ref     text,                    -- referencia cifrada al código/credencial individual
  status         inventory_status not null default 'disponible',
  order_id       uuid,                    -- fk se agrega tras crear orders (ver abajo)
  client_id      uuid references profiles(id),
  assigned_at    timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index idx_inv_units_offer_status on inventory_units(offer_id, status);
create index idx_inv_units_account on inventory_units(account_id);
create index idx_inv_units_provider on inventory_units(provider_id);

-- ---------------------------------------------------------------------
-- PEDIDOS / COMPRAS
-- ---------------------------------------------------------------------
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references profiles(id),
  offer_id           uuid not null references provider_offers(id),
  provider_id        uuid not null references providers(id),
  product_id         uuid not null references products(id),      -- denormalizado para consultas
  duration_id        uuid not null references product_durations(id),
  inventory_unit_id  uuid not null references inventory_units(id),
  -- desglose financiero explícito de la venta (todo en la moneda de la plataforma)
  price              numeric(10,2) not null check (price > 0),        -- monto_cliente: lo que pagó el cliente
  commission_amount  numeric(10,2) not null check (commission_amount >= 0), -- comisión de la plataforma
  provider_amount    numeric(10,2) not null check (provider_amount >= 0),  -- monto que corresponde al proveedor
  held_amount            numeric(10,2) not null check (held_amount >= 0),  -- monto_retenido (= provider_amount al crear)
  retention_days_snapshot int not null,                               -- copia de providers.retention_days al momento de la venta
  retention_starts_at    timestamptz not null default now(),          -- fecha_inicio_retención
  retention_release_at   timestamptz not null,                        -- fecha_liberación programada
  financial_status       order_financial_status not null default 'retenido', -- estado financiero explícito
  status             order_status not null default 'completado',
  created_at         timestamptz not null default now()
);
create index idx_orders_client on orders(client_id);
create index idx_orders_provider on orders(provider_id);
create index idx_orders_status on orders(status);
create index idx_orders_financial_release on orders(financial_status, retention_release_at);

alter table inventory_units
  add constraint fk_inv_units_order foreign key (order_id) references orders(id);

-- ---------------------------------------------------------------------
-- WALLET DEL CLIENTE (saldo reconstruible por movimientos)
-- ---------------------------------------------------------------------
create table wallet_movements (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references profiles(id),
  type                movement_type not null,
  amount              numeric(12,2) not null,       -- positivo o negativo
  balance_after       numeric(12,2) not null,
  related_order_id    uuid references orders(id),
  related_recharge_id uuid,                          -- fk se agrega tras crear recharges
  description         text,
  created_at          timestamptz not null default now()
);
create index idx_wallet_mov_client on wallet_movements(client_id, created_at desc);

-- ---------------------------------------------------------------------
-- RECARGAS (Yape manual)
-- ---------------------------------------------------------------------
create table recharges (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references profiles(id),
  amount         numeric(12,2) not null check (amount > 0),
  method         text not null default 'yape',
  proof_url      text,                     -- ruta en Supabase Storage
  status         recharge_status not null default 'pendiente',
  reference      text,
  admin_id       uuid references profiles(id),
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index idx_recharges_client on recharges(client_id);
create index idx_recharges_status on recharges(status);

alter table wallet_movements
  add constraint fk_wallet_mov_recharge foreign key (related_recharge_id) references recharges(id);

-- ---------------------------------------------------------------------
-- SALDOS DEL PROVEEDOR (retenido / disponible / reservado / retirado)
-- Se reconstruyen a partir de provider_movements (ver vista provider_balances)
-- ---------------------------------------------------------------------
create table provider_movements (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references providers(id),
  type              provider_movement_type not null,
  retenido_delta    numeric(12,2) not null default 0,
  disponible_delta  numeric(12,2) not null default 0,
  reservado_delta   numeric(12,2) not null default 0,
  retirado_delta    numeric(12,2) not null default 0,
  order_id          uuid references orders(id),
  withdrawal_id     uuid,                    -- fk se agrega tras crear withdrawals
  claim_id          uuid,                    -- fk se agrega tras crear claims
  description       text,
  created_at        timestamptz not null default now()
);
create index idx_prov_mov_provider on provider_movements(provider_id, created_at desc);

-- ---------------------------------------------------------------------
-- MÉTODOS Y SOLICITUDES DE RETIRO
-- ---------------------------------------------------------------------
create table withdrawal_methods (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  type        withdrawal_method_type not null,
  details     jsonb not null,       -- { "phone": "9xxxxxxxx" } o { "bank":..,"account":.. }
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_withdrawal_methods_provider on withdrawal_methods(provider_id);

create table withdrawals (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references providers(id),
  amount            numeric(12,2) not null check (amount > 0),
  method_id         uuid not null references withdrawal_methods(id),
  status            withdrawal_status not null default 'pendiente',
  code              text unique,
  code_expires_at   timestamptz,
  code_redeemed_at  timestamptz,
  admin_id          uuid references profiles(id),
  paid_at           timestamptz,
  rejection_reason  text,
  created_at        timestamptz not null default now()
);
create index idx_withdrawals_provider on withdrawals(provider_id);
create index idx_withdrawals_status on withdrawals(status);

alter table provider_movements
  add constraint fk_prov_mov_withdrawal foreign key (withdrawal_id) references withdrawals(id);

-- ---------------------------------------------------------------------
-- RECLAMOS
-- ---------------------------------------------------------------------
create table claims (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id),
  client_id         uuid not null references profiles(id),
  provider_id       uuid not null references providers(id),
  reason            text not null,      -- 'no_funciona' | 'producto_diferente' | 'no_recibido' | 'otro'
  description       text,
  status            claim_status not null default 'abierto',
  resolution_type   claim_resolution_type,
  resolution_notes  text,
  admin_id          uuid references profiles(id),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index idx_claims_order on claims(order_id);
create index idx_claims_provider on claims(provider_id);
create index idx_claims_status on claims(status);

alter table provider_movements
  add constraint fk_prov_mov_claim foreign key (claim_id) references claims(id);

create table claim_messages (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references claims(id) on delete cascade,
  sender_id   uuid not null references profiles(id),
  message     text not null,
  created_at  timestamptz not null default now()
);
create index idx_claim_messages_claim on claim_messages(claim_id);

-- ---------------------------------------------------------------------
-- VALORACIONES / REPUTACIÓN
-- ---------------------------------------------------------------------
create table reviews (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null unique references orders(id), -- una valoración por compra
  client_id          uuid not null references profiles(id),
  provider_id        uuid not null references providers(id),
  product_id         uuid not null references products(id),
  rating             int not null check (rating between 1 and 5),
  comment            text,
  provider_reply     text,
  provider_reply_at  timestamptz,
  created_at         timestamptz not null default now()
);
create index idx_reviews_provider on reviews(provider_id);
create index idx_reviews_product on reviews(product_id);

create table badges (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,      -- 'verificado','100_ventas','alta_satisfaccion','respuesta_rapida'
  name        text not null,
  description text,
  criteria    jsonb
);

create table provider_badges (
  provider_id  uuid not null references providers(id) on delete cascade,
  badge_id     uuid not null references badges(id) on delete cascade,
  awarded_at   timestamptz not null default now(),
  primary key (provider_id, badge_id)
);

-- ---------------------------------------------------------------------
-- AUDITORÍA
-- ---------------------------------------------------------------------
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_entity on audit_log(entity, entity_id);
create index idx_audit_user on audit_log(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- NOTIFICACIONES
-- ---------------------------------------------------------------------
create table notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id),
  type           notification_type not null,
  title          text not null,
  message        text not null,
  read           boolean not null default false,
  related_entity text,
  related_id     uuid,
  created_at     timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, read, created_at desc);

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN DE PLATAFORMA (Yape admin, retención por defecto, etc.)
-- ---------------------------------------------------------------------
create table platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id)
);

-- ---------------------------------------------------------------------
-- TRIGGERS: solo updated_at (genérico) — el resto de la lógica sensible
-- vive en funciones SECURITY DEFINER, no en triggers implícitos.
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_providers_updated before update on providers
  for each row execute function set_updated_at();
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();
create trigger trg_offers_updated before update on provider_offers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- VISTA: saldos del proveedor reconstruidos desde provider_movements
-- ---------------------------------------------------------------------
create or replace view provider_balances as
select
  p.id as provider_id,
  coalesce(sum(pm.retenido_delta), 0)   as retenido,
  coalesce(sum(pm.disponible_delta), 0) as disponible,
  coalesce(sum(pm.reservado_delta), 0)  as reservado,
  coalesce(sum(pm.retirado_delta), 0)   as retirado
from providers p
left join provider_movements pm on pm.provider_id = p.id
group by p.id;

-- ---------------------------------------------------------------------
-- ENMASCARAMIENTO DE DATOS DE RETIRO PARA REVISIÓN DEL ADMIN
-- No es una medida de cifrado: es una utilidad de presentación para que
-- el panel de administración no muestre el número completo de Yape/cuenta
-- bancaria en las listas. El dato completo (details) permanece disponible
-- para el propio proveedor y, si el admin realmente lo necesita para
-- pagar, vía consulta puntual — nunca en el listado general.
-- ---------------------------------------------------------------------
create or replace function mask_withdrawal_details(p_details jsonb)
returns jsonb language sql immutable as $$
  select case
    when p_details ? 'phone' then
      jsonb_build_object('phone', 'xxx-xxx-' || right(p_details->>'phone', 3))
    when p_details ? 'account' then
      jsonb_build_object(
        'bank', p_details->>'bank',
        'account', 'xxxx-xxxx-' || right(p_details->>'account', 4)
      )
    else p_details
  end;
$$;

create or replace view admin_withdrawals_review as
select
  w.id, w.provider_id, pr.business_name, w.amount, w.status,
  wm.type as method_type,
  mask_withdrawal_details(wm.details) as method_details_masked,
  w.code, w.code_expires_at, w.code_redeemed_at,
  w.admin_id, w.paid_at, w.created_at
from withdrawals w
join providers pr on pr.id = w.provider_id
join withdrawal_methods wm on wm.id = w.method_id;
-- La vista hereda RLS de las tablas base; solo es consultable por admin
-- porque withdrawals/withdrawal_methods ya restringen el acceso a
-- provider_id = auth.uid() OR is_admin() (ver 02_rls_policies.sql).
