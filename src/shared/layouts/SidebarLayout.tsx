
import { type ReactNode, useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import './sidebar-layout.css';

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_BY_ROLE: Record<string, NavGroup[]> = {
  cliente: [
    {
      title: 'PRINCIPAL',
      items: [
        { to: '/marketplace', label: 'Tienda', icon: '▦' },
        { to: '/compras', label: 'Mis compras', icon: '◈' },
        { to: '/billetera', label: 'Mi billetera', icon: '▣' },
      ],
    },
    {
      title: 'GESTIÓN',
      items: [
        { to: '/reclamos', label: 'Reclamos', icon: '◇' },
        {
          to: '/notificaciones',
          label: 'Notificaciones',
          icon: '◉',
        },
      ],
    },
  ],

  proveedor: [
    {
      title: 'PRINCIPAL',
      items: [
        {
          to: '/dashboard-proveedor',
          label: 'Dashboard',
          icon: '▦',
        },
        { to: '/marketplace', label: 'Tienda', icon: '⌂' },
        { to: '/inventario', label: 'Mi inventario', icon: '▣' },
        { to: '/ventas', label: 'Mis ventas', icon: '◈' },
      ],
    },
    {
      title: 'FINANZAS Y GESTIÓN',
      items: [
        { to: '/retiros', label: 'Retiros', icon: '▤' },
        { to: '/reclamos', label: 'Reclamos', icon: '◇' },
      ],
    },
    {
      title: 'CUENTA',
      items: [
        {
          to: '/perfil-proveedor',
          label: 'Mi perfil',
          icon: '◉',
        },
      ],
    },
  ],

  admin: [
    {
      title: 'ADMINISTRACIÓN',
      items: [
        { to: '/marketplace', label: 'Tienda', icon: '⌂' },
        {
          to: '/admin/productos',
          label: 'Productos',
          icon: '▣',
        },
        {
          to: '/admin/proveedores',
          label: 'Proveedores',
          icon: '◉',
        },
      ],
    },
    {
      title: 'OPERACIONES',
      items: [
        { to: '/admin/recargas', label: 'Recargas', icon: '▤' },
        { to: '/admin/retiros', label: 'Retiros', icon: '◈' },
        { to: '/admin/cupones', label: 'Cupones', icon: '◇' },
      ],
    },
  ],
};

const DEFAULT_NAV: NavGroup[] = [
  {
    title: 'EXPLORAR',
    items: [
      { to: '/marketplace', label: 'Tienda', icon: '⌂' },
    ],
  },
];

export function SidebarLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const nav = profile
    ? NAV_BY_ROLE[profile.role] ?? DEFAULT_NAV
    : DEFAULT_NAV;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut();
      setOpen(false);
      navigate('/marketplace', { replace: true });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="vx-layout">
      {open && (
        <button
          type="button"
          className="vx-sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`vx-sidebar${open ? ' vx-sidebar--open' : ''}`}
        aria-label="Menú principal"
      >
        <div className="vx-sidebar__brand">
          <Link
            to="/marketplace"
            className="vx-sidebar__logo"
            onClick={() => setOpen(false)}
          >
            <svg
              viewBox="0 0 40 40"
              width="38"
              height="38"
              aria-label="Logo Vexora"
            >
              <path
                d="M6 8 L17 30 L22 30 L34 8 L27 8 L19.5 23 L12 8 Z"
                fill="#FFD100"
              />
              <circle cx="29" cy="9" r="2.6" fill="#F0C24D" />
            </svg>
            <span>VEXORA</span>
          </Link>

          <button
            type="button"
            className="vx-sidebar__close"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="vx-sidebar__role">
          <span className="vx-sidebar__role-dot" />
          {profile?.role === 'proveedor'
            ? 'Panel de vendedor'
            : profile?.role === 'admin'
              ? 'Panel administrador'
              : profile?.role === 'cliente'
                ? 'Panel de cliente'
                : 'Explorar VEXORA'}
        </div>

        <nav className="vx-sidebar__nav">
          {nav.map((group) => (
            <div className="vx-sidebar__group" key={group.title}>
              <div className="vx-sidebar__group-title">
                {group.title}
              </div>

              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/marketplace'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `vx-sidebar__link${
                      isActive ? ' vx-sidebar__link--active' : ''
                    }`
                  }
                >
                  <span
                    className="vx-sidebar__icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="vx-sidebar__footer">
          {!session ? (
            <>
              <Link
                to="/login"
                className="vx-sidebar__login"
                onClick={() => setOpen(false)}
              >
                Iniciar sesión
              </Link>

              <Link
                to="/register"
                className="vx-sidebar__register"
                onClick={() => setOpen(false)}
              >
                Crear cuenta
              </Link>
            </>
          ) : (
            <>
              <div className="vx-sidebar__account">
                <span className="vx-sidebar__avatar">
                  {(profile?.role ?? 'U').charAt(0).toUpperCase()}
                </span>

                <div>
                  <strong>Mi cuenta</strong>
                  <small>{profile?.role ?? 'Usuario'}</small>
                </div>
              </div>

              <button
                type="button"
                className="vx-sidebar__logout"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <span aria-hidden="true">↪</span>
                {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="vx-main">
        <header className="vx-mobile-header">
          <button
            type="button"
            className="vx-mobile-menu"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <Link to="/marketplace" className="vx-mobile-brand">
            <span>V</span> VEXORA
          </Link>
        </header>

        <main className="vx-main__content">
          {children}
        </main>
      </div>
    </div>
  );
}
