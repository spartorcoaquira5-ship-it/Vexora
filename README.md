# Vexora

Marketplace de productos/servicios digitales autorizados. React + Vite + TypeScript + Supabase.

## 1. Base de datos (Supabase)

En el **SQL Editor** de tu proyecto en supabase.com, corre los archivos de `supabase/` **en este orden exacto**, cada uno en su propia query, esperando "Success" antes de pasar al siguiente:

1. `01_schema.sql`
2. `02_rls_policies.sql`
3. `03_functions.sql`
4. `04a_add_plin.sql` — **debe ir solo**, sin nada más en la misma query (Postgres no permite `ALTER TYPE ... ADD VALUE` junto con otras instrucciones).
5. `04_schema_updates.sql`
6. `05_rls_updates.sql`
7. `06_functions_updates.sql`
8. `07_auth_signup.sql`
9. `08_public_views.sql` — vista de stock público (sin ella el marketplace no puede mostrar "Stock X").
10. `09_enforce_verification.sql` — bloquea vender sin verificación a nivel de base de datos, no solo en el frontend.

Luego, en **Storage**, crea dos buckets **privados** con estos nombres exactos:
- `comprobantes`
- `verificacion`

## 2. Variables de entorno

```bash
cp .env.example .env
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los datos de tu proyecto (Project Settings → API → Project URL / Publishable key).

## 3. Instalar y correr

```bash
npm install
npm run dev
```

Abre http://localhost:5173 — debería redirigirte a `/login`.

## 4. Primer usuario admin

El trigger `handle_new_user` siempre crea cuentas nuevas como **cliente** (por diseño: nadie puede auto-asignarse un rol). Para tener tu primer Admin:

1. Regístrate normal desde la app (como cliente).
2. En Supabase → **Table Editor** → tabla `profiles`, busca tu usuario y cambia manualmente la columna `role` a `admin`.

## Estructura del proyecto

```
src/
├── app/              # router, rutas protegidas, redirecciones
├── shared/
│   ├── lib/          # cliente de Supabase
│   ├── hooks/        # useAuth (sesión + perfil + rol)
│   ├── layouts/       # SidebarLayout (sidebar + menú móvil)
│   ├── components/    # componentes reutilizables
│   └── types/         # tipos que reflejan el esquema SQL
└── features/
    └── auth/          # login, registro (cliente/proveedor)
supabase/              # todo el SQL, en orden
```

## Qué está construido

Todos los módulos están conectados a Supabase de verdad (no hay datos inventados en memoria como en el prototipo HTML):

- **Cliente**: Marketplace (comparar ofertas, cupón, comprar), Mis compras (credenciales, abrir reclamo, dejar reseña), Billetera (cargar saldo, subir comprobante, movimientos), Reclamos, Notificaciones.
- **Proveedor**: Mi perfil (bio, verificación con DNI/extracto bancario, nivel, tiempo de respuesta), Mi inventario (agregar cuentas), Mis ventas (retenido/disponible), Retiros (métodos, solicitar, canjear código).
- **Admin**: Productos (crear/activar/desactivar), Recargas (confirmar/rechazar con comprobante), Retiros (aprobar/pagar/rechazar), Proveedores (ver DNI/extracto, aprobar/rechazar verificación), Cupones (crear, enviar a un cliente).

### Pendiente conocido
- **No pude compilarlo de verdad** en este entorno (sin acceso a internet no instalo los paquetes de npm) — es muy probable que al correr `npm install && npm run dev` aparezca algún error suelto de TypeScript o un import mal escrito. Mándamelo tal cual sale en la consola y lo corrijo.
- Si tu proyecto de Supabase tiene **"Confirm email"** activado en Authentication → Providers → Email, el registro como proveedor (`signUpProvider`) no podrá llamar a `fn_become_provider` hasta que el usuario confirme su correo y vuelva a iniciar sesión (no hay sesión activa todavía). Para desarrollo rápido, puedes desactivar esa confirmación temporalmente.
- **Foto de perfil del proveedor**: no la incluí (el prototipo la tenía) — faltaría un bucket público de Storage para avatares. Puedo agregarla después.
- **Pasarela de tarjeta de prueba** (Luhn, CVV): a propósito no está — nunca debe vivir en código propio; eso es integrar un procesador real (Stripe/Culqi) más adelante.
- El menú móvil (☰) del `SidebarLayout` todavía no tiene el botón que lo abre conectado a nada visible en pantallas angostas — hay que probarlo y pulirlo.
- No agregué pruebas automatizadas ni manejo de errores "bonito" (son `alert()` o mensajes simples en varios lados) — prioricé que el flujo de datos funcione primero.
