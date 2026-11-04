
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signUpClient, signUpProvider } from '../api/auth';
import './register.css';

type RegistrationState = {
  message?: string;
  returnTo?: string;
  productId?: string;
  durationId?: string;
  offerId?: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const purchaseState = (location.state ?? {}) as RegistrationState;

  const [role, setRole] = useState<'cliente' | 'proveedor'>('cliente');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmailMsg, setCheckEmailMsg] = useState(false);

  const loginState = {
    ...purchaseState,
    returnTo: purchaseState.returnTo || '/marketplace',
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      return setError('Ingresa tu nombre completo.');
    }

    if (password.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres.');
    }

    if (password !== password2) {
      return setError('Las contraseñas no coinciden.');
    }

    if (role === 'proveedor' && !businessName.trim()) {
      return setError('Ingresa el nombre de tu negocio.');
    }

    setLoading(true);

    try {
      const data =
        role === 'cliente'
          ? await signUpClient(email, password, fullName)
          : await signUpProvider(email, password, fullName, businessName);

      if (data.session) {
        navigate('/marketplace', {
          replace: true,
          state: purchaseState.offerId
            ? {
                productId: purchaseState.productId,
                durationId: purchaseState.durationId,
                offerId: purchaseState.offerId,
              }
            : undefined,
        });
      } else {
        setCheckEmailMsg(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la cuenta.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkEmailMsg) {
    return (
      <div className="vex-register-confirm">
        <div className="vex-register-confirm-card">
          <Link to="/" className="vex-register-logo">
            <span>V</span> VEXORA
          </Link>

          <div className="vex-confirm-icon">✉</div>

          <h1>Revisa tu correo</h1>

          <p>
            Te enviamos un enlace de confirmación a{' '}
            <strong>{email}</strong>.
          </p>

          <p>
            Confirma tu correo y después inicia sesión
            para continuar.
          </p>

          <Link
            to="/login"
            state={loginState}
            className="vex-register-submit vex-register-link-button"
          >
            Ir a inicio de sesión
          </Link>

          <Link to="/" className="vex-register-back">
            ← Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="vex-register-page">
      <aside className="vex-register-left">
        <Link to="/" className="vex-register-logo">
          <span>V</span> VEXORA
        </Link>

        <div className="vex-register-left-content">
          <h1>
            Compra y vende productos
            digitales con respaldo real.
          </h1>

          <p>
            Ofertas comparables por proveedor,
            saldo trazable y soporte ante reclamos.
            Todo en un solo lugar.
          </p>
        </div>

        <div className="vex-register-left-footer">
          <span>Compara proveedores</span>
          <span>Compra con confianza</span>
        </div>
      </aside>

      <main className="vex-register-right">
        <div className="vex-register-form-container">
          <Link to="/" className="vex-register-back">
            ← Volver a la tienda
          </Link>

          {purchaseState.message && (
            <div className="vex-register-notice">
              {purchaseState.message}
            </div>
          )}

          <h2>Crea tu cuenta</h2>

          <p className="vex-register-subtitle">
            Regístrate como cliente o proveedor.
          </p>

          <div className="vex-register-roles">
            <button
              type="button"
              className={
                role === 'cliente'
                  ? 'vex-register-role active'
                  : 'vex-register-role'
              }
              onClick={() => setRole('cliente')}
            >
              <span className="vex-register-role-icon client">
                ♙
              </span>
              <span>
                <strong>Cliente</strong>
                <small>Quiero comprar</small>
              </span>
            </button>

            <button
              type="button"
              className={
                role === 'proveedor'
                  ? 'vex-register-role active'
                  : 'vex-register-role'
              }
              onClick={() => setRole('proveedor')}
            >
              <span className="vex-register-role-icon provider">
                ▣
              </span>
              <span>
                <strong>Proveedor</strong>
                <small>Quiero vender</small>
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="vex-register-form">
            <div className="vex-register-field">
              <label htmlFor="fullName">Nombre completo</label>
              <input
                id="fullName"
                type="text"
                placeholder="Tu nombre"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>

            {role === 'proveedor' && (
              <div className="vex-register-field">
                <label htmlFor="businessName">
                  Nombre de tu negocio
                </label>
                <input
                  id="businessName"
                  type="text"
                  placeholder="Nombre de tu tienda"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="vex-register-field">
              <label htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                placeholder="nombre@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="vex-register-password-grid">
              <div className="vex-register-field">
                <label htmlFor="password">Contraseña</label>
                <div className="vex-register-password-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div className="vex-register-field">
                <label htmlFor="password2">Confirmar</label>
                <div className="vex-register-password-wrap">
                  <input
                    id="password2"
                    type={showPassword2 ? 'text' : 'password'}
                    placeholder="Repite la contraseña"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                  >
                    {showPassword2 ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="vex-register-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="vex-register-submit"
              disabled={loading}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="vex-register-login">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" state={loginState}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
