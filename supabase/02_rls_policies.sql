-- =====================================================================
-- 02_rls_policies.sql — Row Level Security
--
-- PRINCIPIO RECTOR (aplicado en todo este archivo):
-- Las tablas de "ledger" financiero (wallet_movements, provider_movements,
-- orders, audit_log) NO tienen policy de INSERT/UPDATE/DELETE para NINGÚN
-- rol, ni siquiera admin. La única forma de escribirlas es a través de las
-- funciones SECURITY DEFINER de 03_functions.sql, que se ejecutan con el
-- owner de la función (el rol que las crea en Supabase, normalmente
-- "postgres"), el cual por diseño de Postgres omite RLS al no tener
-- activado FORCE ROW LEVEL SECURITY en estas tablas. Así se garantiza que
-- ni siquiera un admin autenticado puede alterar saldos vía la API REST
-- directa: solo puede hacerlo llamando al RPC correspondiente, que además
-- valida reglas de negocio y deja rastro en audit_log.
-- =====================================================================

-- ---------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------
create or replace function current_role_safe()
returns user_role
language sql stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select current_role_safe() = 'admin';
$$;

-- ---------------------------------------------------------------------
-- ENABLE RLS
-- ---------------------------------------------------------------------
alter table profiles              enable row level security;
alter table providers              enable row level security;
alter table categories             enable row level security;
alter table products               enable row level security;
alter table product_durations      enable row level security;
alter table provider_offers        enable row level security;
alter table inventory_accounts     enable row level security;
alter table inventory_units        enable row level security;
alter table orders                 enable row level security;
alter table wallet_movements       enable row level security;
alter table recharges              enable row level security;
alter table provider_movements     enable row level security;
alter table withdrawal_methods     enable row level security;
alter table withdrawals            enable row level security;
alter table claims                 enable row level security;
alter table claim_messages         enable row level security;
alter table reviews                enable row level security;
alter table badges                 enable row level security;
alter table provider_badges        enable row level security;
alter table audit_log              enable row level security;
alter table notifications          enable row level security;
alter table platform_settings      enable row level security;

-- ---------------------------------------------------------------------
-- PROFILES
-- Nadie puede cambiar su propio rol ni su wallet_balance vía UPDATE
-- directo: el WITH CHECK obliga a que ambos campos permanezcan iguales
-- a menos que quien ejecuta sea admin.
-- ---------------------------------------------------------------------
create policy profiles_select_self on profiles for select
  using (id = auth.uid() or is_admin());

create policy profiles_update_self on profiles for update
  using (id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (
      id = auth.uid()
      and role = (select role from profiles where id = auth.uid())
      and wallet_balance = (select wallet_balance from profiles where id = auth.uid())
    )
  );

create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid() and role = 'cliente' and wallet_balance = 0);
  -- el registro inicial siempre es 'cliente' con saldo 0; convertirse en
  -- proveedor es una acción explícita de negocio (crear fila en providers),
  -- nunca un auto-ascenso de rol en profiles.

-- ---------------------------------------------------------------------
-- PROVIDERS (perfil público limitado + gestión propia + admin total)
-- El proveedor no puede cambiar su propio status (activo/suspendido/...);
-- eso es exclusivo de fn_set_provider_status (admin).
-- ---------------------------------------------------------------------
create policy providers_select_public on providers for select
  using (true); -- datos públicos objetivos (rating, ventas); credenciales NO están aquí

create policy providers_update_self on providers for update
  using (id = auth.uid() or is_admin())
  with check (
    is_admin()
    or (id = auth.uid() and status = (select status from providers where id = auth.uid()))
  );

create policy providers_insert_self on providers for insert
  with check (id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- CATEGORIES / PRODUCTS / DURATIONS: lectura pública, escritura solo admin
-- (auditadas por trigger, ver 03_functions.sql)
-- ---------------------------------------------------------------------
create policy categories_select_all on categories for select using (true);
create policy categories_write_admin on categories for all
  using (is_admin()) with check (is_admin());

create policy products_select_all on products for select using (active or is_admin());
create policy products_write_admin on products for all
  using (is_admin()) with check (is_admin());

create policy durations_select_all on product_durations for select using (active or is_admin());
create policy durations_write_admin on product_durations for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- PROVIDER_OFFERS: lectura pública de ofertas activas; el proveedor
-- gestiona solo las suyas (precio/comisión visibles aquí, pero un cambio
-- futuro NUNCA afecta pedidos ya creados: éstos guardan su propio
-- price/commission_amount/provider_amount congelados). Admin todo.
-- ---------------------------------------------------------------------
create policy offers_select_public on provider_offers for select
  using (status = 'activo' or provider_id = auth.uid() or is_admin());
create policy offers_insert_owner on provider_offers for insert
  with check (provider_id = auth.uid() or is_admin());
create policy offers_update_owner on provider_offers for update
  using (provider_id = auth.uid() or is_admin())
  with check (provider_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- INVENTORY_ACCOUNTS: el proveedor administra sus propios contenedores.
-- credentials_encrypted queda con SELECT revocado a nivel de columna más
-- abajo; aquí solo se controla la fila.
-- ---------------------------------------------------------------------
create policy inv_accounts_owner_all on inventory_accounts for all
  using (provider_id = auth.uid() or is_admin())
  with check (provider_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- INVENTORY_UNITS
-- Lectura: proveedor dueño, admin, o el cliente al que le fue asignada.
-- Escritura directa del proveedor SOLO permitida mientras la unidad sigue
-- 'disponible' (sin vender) y el UPDATE no intente asignarla a un pedido/
-- cliente. Esto cierra la vía por la que un proveedor podría, vía API
-- REST directa, marcar una unidad como 'asignado' a un cliente sin que
-- exista una compra real: esa transición SOLO ocurre dentro de
-- fn_purchase_offer (SECURITY DEFINER), que corre fuera de RLS.
-- ---------------------------------------------------------------------
create policy inv_units_select on inventory_units for select
  using (
    provider_id = auth.uid()
    or is_admin()
    or client_id = auth.uid()
  );

create policy inv_units_insert_owner on inventory_units for insert
  with check (
    (provider_id = auth.uid() and status = 'disponible' and order_id is null and client_id is null)
    or is_admin()
  );

create policy inv_units_update_owner on inventory_units for update
  using ((provider_id = auth.uid() and status = 'disponible') or is_admin())
  with check (
    is_admin()
    or (
      provider_id = auth.uid()
      and status = 'disponible'
      and order_id is null
      and client_id is null
    )
  );

-- ---------------------------------------------------------------------
-- ORDERS: solo lectura para las partes involucradas. Sin policy de
-- INSERT/UPDATE/DELETE para ningún rol — la creación y todo cambio de
-- estado (status, financial_status) ocurre exclusivamente dentro de
-- fn_purchase_offer / fn_release_expired_retentions / fn_resolve_claim.
-- ---------------------------------------------------------------------
create policy orders_select_own on orders for select
  using (client_id = auth.uid() or provider_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- WALLET_MOVEMENTS: solo lectura del propio historial. Sin policy de
-- escritura para nadie (ni admin): el ledger del cliente solo lo generan
-- fn_confirm_recharge, fn_purchase_offer y fn_resolve_claim.
-- ---------------------------------------------------------------------
create policy wallet_mov_select_own on wallet_movements for select
  using (client_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- RECHARGES
-- El cliente puede crear su propia solicitud y cancelarla mientras esté
-- pendiente (no mueve dinero). Confirmar/rechazar (sí mueve dinero) es
-- exclusivo de fn_confirm_recharge / fn_reject_recharge — sin policy de
-- UPDATE para admin aquí.
-- ---------------------------------------------------------------------
create policy recharges_select_own on recharges for select
  using (client_id = auth.uid() or is_admin());

create policy recharges_insert_own on recharges for insert
  with check (client_id = auth.uid() and status = 'pendiente');

create policy recharges_cancel_own on recharges for update
  using (client_id = auth.uid() and status = 'pendiente')
  with check (client_id = auth.uid() and status = 'cancelada');

-- ---------------------------------------------------------------------
-- PROVIDER_MOVEMENTS: solo lectura del propio historial. Sin escritura
-- directa para nadie — lo generan las funciones de venta/retención/
-- retiro/reclamo.
-- ---------------------------------------------------------------------
create policy prov_mov_select_own on provider_movements for select
  using (provider_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- WITHDRAWAL METHODS: el proveedor administra los suyos directamente
-- (no es dinero, son datos de contacto para el pago manual).
-- ---------------------------------------------------------------------
create policy wmethods_owner on withdrawal_methods for all
  using (provider_id = auth.uid() or is_admin())
  with check (provider_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------
-- WITHDRAWALS: solo lectura para las partes. La creación de la solicitud
-- también queda disponible por RLS (no mueve dinero por sí sola: el
-- movimiento de reserva lo hace fn_request_withdrawal). Aprobar, rechazar,
-- marcar pagado y canjear código son EXCLUSIVOS de sus respectivas
-- funciones — no hay policy de UPDATE aquí para ningún rol.
-- ---------------------------------------------------------------------
create policy withdrawals_select_own on withdrawals for select
  using (provider_id = auth.uid() or is_admin());

create policy withdrawals_insert_own on withdrawals for insert
  with check (provider_id = auth.uid() and status = 'pendiente');

-- ---------------------------------------------------------------------
-- CLAIMS
-- El cliente puede abrir un reclamo sobre su propio pedido. La resolución
-- (que mueve dinero) es exclusiva de fn_resolve_claim — sin policy de
-- UPDATE para admin aquí.
-- ---------------------------------------------------------------------
create policy claims_select_participants on claims for select
  using (client_id = auth.uid() or provider_id = auth.uid() or is_admin());

create policy claims_insert_client on claims for insert
  with check (
    client_id = auth.uid()
    and exists (select 1 from orders o where o.id = order_id and o.client_id = auth.uid())
  );

-- El proveedor puede mover el reclamo a 'en_revision' al responder, pero
-- no puede resolverlo ni tocar campos de resolución/dinero.
create policy claims_provider_respond on claims for update
  using (provider_id = auth.uid() and status = 'abierto')
  with check (
    provider_id = auth.uid()
    and status = 'en_revision'
    and resolution_type is null
  );

create policy claim_messages_select on claim_messages for select
  using (
    exists (select 1 from claims c where c.id = claim_id
            and (c.client_id = auth.uid() or c.provider_id = auth.uid() or is_admin()))
  );
create policy claim_messages_insert on claim_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from claims c where c.id = claim_id
                and (c.client_id = auth.uid() or c.provider_id = auth.uid() or is_admin()))
  );

-- ---------------------------------------------------------------------
-- REVIEWS
-- La creación vía RLS queda restringida a compras propias y completadas
-- (fn_submit_review aplica la misma regla; se deja también aquí como
-- defensa en profundidad). La respuesta del proveedor solo puede tocar
-- su propio campo de respuesta.
-- ---------------------------------------------------------------------
create policy reviews_select_all on reviews for select using (true);

create policy reviews_insert_buyer on reviews for insert
  with check (
    client_id = auth.uid()
    and exists (select 1 from orders o where o.id = order_id and o.client_id = auth.uid()
                and o.status = 'completado')
  );

create policy reviews_provider_reply on reviews for update
  using (provider_id = auth.uid() or is_admin())
  with check (provider_id = auth.uid() or is_admin());
-- La inmutabilidad de rating/comment/client_id/order_id ante un UPDATE
-- del proveedor se refuerza con un trigger (ver trg_reviews_protect en
-- 03_functions.sql), que es más confiable que una subconsulta
-- autorreferencial dentro de WITH CHECK.

-- ---------------------------------------------------------------------
-- BADGES
-- ---------------------------------------------------------------------
create policy badges_select_all on badges for select using (true);
create policy badges_write_admin on badges for all using (is_admin()) with check (is_admin());
create policy provider_badges_select_all on provider_badges for select using (true);
create policy provider_badges_write_admin on provider_badges for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- AUDIT LOG: solo admin lee; nadie escribe directamente (ni admin). Toda
-- fila la inserta log_audit(), que corre como SECURITY DEFINER.
-- ---------------------------------------------------------------------
create policy audit_select_admin on audit_log for select using (is_admin());

-- ---------------------------------------------------------------------
-- NOTIFICATIONS
-- El usuario solo puede marcar sus propias notificaciones como leídas
-- (no puede editar título/mensaje/tipo). La inserción normal la hace
-- notify_user() (SECURITY DEFINER); no hay policy de INSERT para nadie.
-- ---------------------------------------------------------------------
create policy notifications_select_own on notifications for select
  using (user_id = auth.uid() or is_admin());

create policy notifications_mark_read on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- La inmutabilidad de title/message/type ante este UPDATE (el usuario
-- solo debería poder cambiar "read") se refuerza con un trigger
-- (ver trg_notifications_protect en 03_functions.sql).

-- ---------------------------------------------------------------------
-- PLATFORM SETTINGS: solo admin, con auditoría por trigger.
-- ---------------------------------------------------------------------
create policy settings_select_admin on platform_settings for select using (is_admin());
create policy settings_write_admin on platform_settings for all
  using (is_admin()) with check (is_admin());

-- =====================================================================
-- SEGURIDAD DE COLUMNAS SENSIBLES (defensa adicional a RLS)
--
-- RLS controla FILAS, no columnas. Un proveedor con acceso de fila a su
-- propio inventory_units podría, en teoría, seguir leyendo secret_ref por
-- REST aunque ya no le sirva de nada operativamente, y un cliente con
-- acceso de fila a la unidad que compró podría leer secret_ref incluso
-- después de un reembolso. Para evitar ambos casos, se revoca el
-- privilegio de SELECT sobre las columnas de credenciales a nivel de
-- COLUMNA para el rol "authenticated" (el que usa PostgREST/Supabase
-- para usuarios logueados). El único camino para leer una credencial
-- pasa entonces por las funciones fn_get_inventory_credentials(),
-- fn_get_own_inventory_secret() y fn_get_own_account_credentials()
-- (ver 03_functions.sql), que SÍ pueden leer la columna porque corren
-- como el owner de la función, y que además aplican las reglas de
-- negocio (dueño correcto, pedido no reembolsado, unidad no vencida).
-- =====================================================================
revoke select (secret_ref) on inventory_units from authenticated;
revoke select (credentials_encrypted) on inventory_accounts from authenticated;

-- =====================================================================
-- STORAGE: comprobantes de recarga y documentos de verificación
--
-- Asume dos buckets PRIVADOS creados desde el dashboard de Supabase:
--   "comprobantes"  -> comprobantes de recarga (y de pago de retiro si se
--                       necesitan más adelante)
--   "verificacion"  -> documentos de verificación de identidad/negocio
-- Convención de rutas: el primer segmento del path es el uid del dueño
-- del archivo, ej. "comprobantes/<auth.uid()>/2026-09-24-recarga.jpg".
-- Así cada usuario solo puede subir/leer dentro de su propia carpeta, y
-- el admin puede leer todo para revisar recargas/verificaciones.
-- =====================================================================
create policy storage_comprobantes_insert_own on storage.objects for insert
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_comprobantes_select on storage.objects for select
  using (
    bucket_id = 'comprobantes'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
-- Sin policy de update/delete: un comprobante subido no debe alterarse
-- ni borrarse una vez enviado (evidencia para auditoría).

create policy storage_verificacion_insert_own on storage.objects for insert
  with check (
    bucket_id = 'verificacion'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy storage_verificacion_select on storage.objects for select
  using (
    bucket_id = 'verificacion'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
