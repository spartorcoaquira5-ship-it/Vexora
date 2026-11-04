-- =====================================================================
-- 04_schema_updates.sql — Todo lo agregado después del prototipo inicial:
-- cupones de descuento, verificación de identidad de proveedores (DNI +
-- extracto bancario), método de retiro "Plin", descuento aplicado a
-- pedidos, y vistas de nivel de vendedor / tiempo de respuesta.
-- Requiere haber corrido antes 01_schema.sql, 02_rls_policies.sql,
-- 03_functions.sql, y 04a_add_plin.sql (ese va SIEMPRE primero y solo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- VERIFICACIÓN DE IDENTIDAD DEL PROVEEDOR (DNI + extracto bancario)
-- "Verificado" (providers.verified) solo lo otorga un Admin a mano, nunca
-- se calcula solo. Estas columnas guardan la SOLICITUD y su revisión.
-- ---------------------------------------------------------------------
create type provider_verification_status as enum ('ninguna','pendiente','aprobada','rechazada');

alter table providers
  add column if not exists bio                       text,
  add column if not exists verification_status        provider_verification_status not null default 'ninguna',
  add column if not exists verification_note           text,
  add column if not exists dni_proof_path              text,   -- ruta en el bucket privado "verificacion"
  add column if not exists bank_statement_proof_path    text,   -- ruta en el bucket privado "verificacion"
  add column if not exists verification_submitted_at    timestamptz,
  add column if not exists verification_reviewed_by     uuid references profiles(id),
  add column if not exists verification_reviewed_at     timestamptz;

-- ---------------------------------------------------------------------
-- CUPONES DE DESCUENTO (los crea el Admin; el cliente los aplica al comprar)
-- ---------------------------------------------------------------------
create table coupons (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  type        commission_type not null,           -- reutiliza 'porcentaje' | 'monto_fijo'
  value       numeric(10,2) not null check (value > 0),
  max_uses    int not null check (max_uses >= 1),
  uses        int not null default 0 check (uses >= 0),
  product_id  uuid references products(id),        -- opcional: restringe el cupón a un producto
  active      boolean not null default true,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  check (uses <= max_uses)
);
create index idx_coupons_code on coupons(code) where active;

-- ---------------------------------------------------------------------
-- ORDERS: registrar si el pedido usó un cupón y cuánto se descontó
-- (el precio ya pagado por el cliente — orders.price — ya refleja el
-- descuento aplicado; estas columnas son solo trazabilidad adicional)
-- ---------------------------------------------------------------------
alter table orders
  add column if not exists coupon_id       uuid references coupons(id),
  add column if not exists discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0);

-- ---------------------------------------------------------------------
-- VISTA: nivel del vendedor (insignia automática, por ventas reales)
-- Bronce / Plata / Oro / Platino / Diamante — nadie la compra ni la pide,
-- sube sola según ventas, rating y tasa de pedidos sin reclamo.
-- ---------------------------------------------------------------------
create or replace view provider_tier as
select
  base.provider_id,
  case
    when base.sales >= 300 and base.rating >= 4.8 and base.no_claim_rate >= 0.97 then 'diamante'
    when base.sales >= 150 and base.rating >= 4.6 and base.no_claim_rate >= 0.95 then 'platino'
    when base.sales >= 50  and base.rating >= 4.3 and base.no_claim_rate >= 0.90 then 'oro'
    when base.sales >= 15  and base.rating >= 4.0 then 'plata'
    else 'bronce'
  end as tier,
  base.sales, base.rating, base.no_claim_rate
from (
  select
    pr.id as provider_id,
    pr.sales_count as sales,
    pr.rating_avg as rating,
    case when pr.sales_count > 0
      then 1 - (coalesce(cl.claim_count, 0)::numeric / pr.sales_count)
      else 1
    end as no_claim_rate
  from providers pr
  left join (
    select provider_id, count(*) as claim_count from claims group by provider_id
  ) cl on cl.provider_id = pr.id
) base;

-- ---------------------------------------------------------------------
-- VISTA: tiempo de respuesta promedio del proveedor ante reclamos
-- (horas entre que se abre el reclamo y su primer mensaje en él)
-- ---------------------------------------------------------------------
create or replace view provider_response_hours as
select
  c.provider_id,
  avg(extract(epoch from (pm.first_reply - c.created_at)) / 3600.0) as avg_hours,
  count(*) as claims_considered
from claims c
join lateral (
  select min(cm.created_at) as first_reply
  from claim_messages cm
  where cm.claim_id = c.id and cm.sender_id = c.provider_id
) pm on pm.first_reply is not null
group by c.provider_id;
