
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import './storefront.css';

export function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { session, profile, signOut } = useAuth();

  return (
    <div className="vex-storefront">
      <header className="vex-store-header">
        <Link to="/" className="vex-store-brand">
          <span>V</span>
          <strong>VEXORA</strong>
        </Link>

        <nav className="vex-store-nav">
          <a href="/#ofertas">Ofertas</a>
          <a href="/#como-funciona">Cómo funciona</a>
          <a href="/#preguntas">Preguntas</a>
        </nav>

        <div className="vex-store-actions">
          {!session ? (
            <>
              <Link to="/login" className="vex-store-login">
                Ingresar
              </Link>
              <Link to="/register" className="vex-store-register">
                Crear cuenta
              </Link>
            </>
          ) : (
            <>
              {profile?.role === 'admin' && (
                <Link to="/admin/productos" className="vex-store-login">
                  Administración
                </Link>
              )}

              {profile?.role === 'proveedor' && (
                <Link to="/inventario" className="vex-store-login">
                  Mi inventario
                </Link>
              )}

              {profile?.role === 'cliente' && (
                <Link to="/compras" className="vex-store-login">
                  Mis compras
                </Link>
              )}

              <button
                type="button"
                className="vex-store-register"
                onClick={() => void signOut()}
              >
                Salir
              </button>
            </>
          )}
        </div>
      </header>

      <main className="vex-store-main">
        {children}
      </main>
    </div>
  );
}
