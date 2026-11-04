
import { type ReactNode, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';

type NavItem = {
  to: string;
  label: string;
};

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  cliente: [
    { to: '/marketplace', label: 'Tienda' },
    { to: '/compras', label: 'Mis compras' },
    { to: '/billetera', label: 'Mi billetera' },
    { to: '/reclamos', label: 'Reclamos' },
    { to: '/notificaciones', label: 'Notificaciones' },
  ],
  proveedor: [
    { to: '/marketplace', label: 'Tienda' },
    { to: '/perfil-proveedor', label: 'Mi perfil' },
    { to: '/inventario', label: 'Mi inventario' },
    { to: '/ventas', label: 'Mis ventas' },
    { to: '/retiros', label: 'Retiros' },
    { to: '/reclamos', label: 'Reclamos' },
  ],
  admin: [
    { to: '/marketplace', label: 'Tienda' },
    { to: '/admin/productos', label: 'Productos' },
    { to: '/admin/recargas', label: 'Recargas' },
    { to: '/admin/retiros', label: 'Retiros' },
    { to: '/admin/proveedores', label: 'Proveedores' },
    { to: '/admin/cupones', label: 'Cupones' },
  ],
};

export function SidebarLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const nav: NavItem[] = profile
    ? NAV_BY_ROLE[profile.role] ?? [
        { to: '/marketplace', label: 'Tienda' },
      ]
    : [{ to: '/marketplace', label: 'Tienda' }];

  async function handleLogout() {
    try {
      await signOut();
      setOpen(false);
      navigate('/marketplace', { replace: true });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        className={`sidebar${open ? ' open' : ''}`}
        style={{
          width: 230,
          flexShrink: 0,
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          padding: '1.5rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        {/* LOGO */}
        <Link
          to="/marketplace"
          onClick={() => setOpen(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingBottom: '1.5rem',
            textDecoration: 'none',
            color: 'var(--text)',
          }}
        >
          <svg
            viewBox="0 0 40 40"
            width={36}
            height={36}
            aria-label="Logo Vexora"
          >
            <path
              d="M6 8 L17 30 L22 30 L34 8 L27 8 L19.5 23 L12 8 Z"
              fill="#FFD100"
            />
            <circle
              cx="29"
              cy="9"
              r="2.6"
              fill="#F0C24D"
            />
          </svg>

          <span
            style={{
              fontWeight: 800,
              fontSize: 21,
              letterSpacing: '0.04em',
            }}
          >
            VEXORA
          </span>
        </Link>

        {/* NAVEGACIÓN */}
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            style={({ isActive }) => ({
              padding: '12px 14px',
              borderRadius: 10,
              color: isActive ? '#111' : 'var(--text-2)',
              background: isActive
                ? 'var(--yellow)'
                : 'transparent',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
            })}
          >
            {item.label}
          </NavLink>
        ))}

        {/* CUENTA */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {!session ? (
            <>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                style={{
                  background: 'var(--yellow)',
                  color: '#111',
                  padding: '12px',
                  borderRadius: 10,
                  textAlign: 'center',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Iniciar sesión
              </Link>

              <Link
                to="/register"
                onClick={() => setOpen(false)}
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '12px',
                  borderRadius: 10,
                  textAlign: 'center',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Crear cuenta
              </Link>
            </>
          ) : (
            <>
              <div
                style={{
                  color: 'var(--text-2)',
                  fontSize: 13,
                  padding: '8px 12px',
                }}
              >
                {profile
                  ? `Cuenta: ${profile.role}`
                  : 'Sesión iniciada'}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text-2)',
                  padding: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div
        className="main-content"
        style={{
          flex: 1,
          marginLeft: 230,
          minWidth: 0,
        }}
      >
        <header
          className="topbar-mobile"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 12,
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            aria-label="Abrir o cerrar menú"
            onClick={() => setOpen((value) => !value)}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: 36,
              height: 36,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            ☰
          </button>

          <strong>VEXORA</strong>
        </header>

        <main style={{ padding: '2rem 2.25rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
