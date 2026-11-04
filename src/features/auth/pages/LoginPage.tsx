import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg viewBox="0 0 40 40" width={32} height={32} aria-label="Logo Vexora">
            <path d="M6 8 L17 30 L22 30 L34 8 L27 8 L19.5 23 L12 8 Z" fill="#FFD100" />
            <circle cx="29" cy="9" r="2.6" fill="#F0C24D" />
          </svg>
          <span style={{ fontWeight: 800, letterSpacing: '0.03em', fontSize: 18 }}>VEXORA</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 500, margin: '0 0 6px' }}>Inicia sesión</h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 24px' }}>Ingresa tus datos para continuar.</p>

        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-2)', marginTop: 20 }}>
          ¿No tienes cuenta? <Link to="/register" style={{ color: 'var(--yellow-dark)' }}>Regístrate</Link>
        </p>
      </form>
    </div>
  );
}
