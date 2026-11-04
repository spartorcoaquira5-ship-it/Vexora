-- =====================================================================
-- 04a_add_plin.sql — Corre este archivo SOLO, en su propia query, antes
-- de 04b. Postgres no permite "alter type ... add value" junto con
-- otras instrucciones en el mismo bloque — por eso va aparte.
-- =====================================================================
alter type withdrawal_method_type add value if not exists 'plin';
