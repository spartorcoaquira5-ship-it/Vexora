import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { getMyProvider, updateProviderProfile, uploadVerificationDoc, submitVerification, getTier, getResponseHours } from '../api/provider';
import type { Provider } from '@/shared/types/db';
import { StatusPill } from '@/shared/components/StatusPill';

export default function ProviderProfilePage() {
  const { profile } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [tier, setTier] = useState<{ tier: string; sales: number } | null>(null);
  const [responseHours, setResponseHours] = useState<number | null>(null);
  const [dniFile, setDniFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const p = await getMyProvider();
    setProvider(p);
    setBusinessName(p.business_name);
    setBio(p.bio ?? '');
    const t = await getTier(p.id);
    setTier(t);
    const rh = await getResponseHours(p.id);
    setResponseHours(rh?.avg_hours ?? null);
  }
  useEffect(() => { load(); }, []);

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await updateProviderProfile(businessName, bio);
      setMsg('Perfil actualizado.');
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitVerification() {
    if (!profile || !dniFile || !bankFile) return setError('Adjunta ambos documentos: DNI y extracto bancario.');
    setError(null);
    setSaving(true);
    try {
      const dniPath = await uploadVerificationDoc('dni', dniFile, profile.id);
      const bankPath = await uploadVerificationDoc('bank', bankFile, profile.id);
      await submitVerification(dniPath, bankPath);
      setMsg('Documentos enviados. Quedan en revisión.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la verificación.');
    } finally {
      setSaving(false);
    }
  }

  if (!provider) return <p style={{ color: 'var(--text-2)' }}>Cargando...</p>;

  return (
    <div>
      <h1 style={{ margin: '0 0 16px' }}>Mi perfil</h1>

      <div className="panel-card">
        <h3>Tu estado</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {provider.verified && <span style={{ background: 'var(--green-light)', color: 'var(--green-dark)', fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>✓ Verificado</span>}
          {tier && <span style={{ background: 'var(--yellow-light)', color: 'var(--yellow-dark)', fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 999, textTransform: 'capitalize' }}>{tier.tier}</span>}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
          {tier?.sales ?? 0} ventas · Tiempo de respuesta: {responseHours == null ? 'Sin datos aún' : responseHours < 1 ? `~${Math.round(responseHours * 60)} min` : `~${Math.round(responseHours)} h`}
        </p>
      </div>

      <div className="panel-card">
        <h3>Verificación de identidad</h3>
        <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
          Para poder vender necesitas enviar tu DNI y un extracto bancario reciente. Un administrador los revisa manualmente.
        </p>
        {provider.verified ? (
          <StatusPill status="confirmada" />
        ) : provider.verification_status === 'pendiente' ? (
          <StatusPill status="pendiente" />
        ) : (
          <>
            {provider.verification_status === 'rechazada' && (
              <p className="error">Rechazada: {provider.verification_note}. Vuelve a enviar tus documentos.</p>
            )}
            <div className="form-grid">
              <div className="field">
                <label>Foto o escaneo de tu DNI</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setDniFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="field">
                <label>Extracto bancario reciente</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setBankFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="primary" style={{ maxWidth: 240 }} disabled={saving} onClick={handleSubmitVerification}>
              Enviar para verificación
            </button>
          </>
        )}
      </div>

      <div className="panel-card">
        <h3>Datos del negocio</h3>
        <div className="field">
          <label>Nombre del negocio</label>
          <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="field">
          <label>Descripción</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        {msg && <p style={{ color: 'var(--green-dark)', fontSize: 13 }}>{msg}</p>}
        <button className="primary" style={{ maxWidth: 200 }} disabled={saving} onClick={handleSaveProfile}>Guardar cambios</button>
      </div>
    </div>
  );
}
