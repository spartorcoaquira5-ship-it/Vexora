-- =====================================================================
-- 08_public_views.sql — El marketplace necesita mostrar "Stock 12" en
-- cada oferta, pero inventory_units NO es legible por clientes (tiene
-- credenciales). Esta vista expone solo el conteo, nunca las filas.
-- =====================================================================
create or replace view offer_stock as
select offer_id, count(*) as stock
from inventory_units
where status = 'disponible'
group by offer_id;

-- La vista corre con los privilegios de quien la crea (normalmente el
-- rol que ejecuta las migraciones), así que no hereda el RLS de
-- inventory_units: cualquiera puede leer el conteo, nadie puede leer
-- las filas reales de abajo.
grant select on offer_stock to authenticated, anon;
