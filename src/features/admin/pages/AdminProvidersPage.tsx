import { useEffect, useState } from 'react';
import { listAllProviders, reviewVerification, getVerificationDocUrl, toggleVerified } from '../api/admin';
import { StatusPill } from '@/shared/components/StatusPill';

interface ProviderRow {
  id: string; business_name: string; verified: boolean; verification_status: string;
  verification_note: string | null; dni_proof_path: string | null; bank_statement_proof_path: string | null;
  sales_count: number;
}

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  function load() {
    listAllProviders().then((p) => setProviders(p as ProviderRow[]));
  }
  useEffect(() => { load(); }, []);

  async function handleView(path: string) {
    const url = await getVerificationDocUrl(path);
    window.open(url, '_blank');
  }
  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Proveedores</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>La verificación es manual y a tu criterio.</p>

      {providers.map((p) => (
        <div key={p.id} className="panel-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ flex: 1 }}>{p.business_name}</strong>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.sales_count} ventas</span>
            {p.verified && <StatusPill status="confirmada" />}
            {p.verified && (
              <button className="mini-btn" onClick={() => toggleVerified(p.id, false).then(load)}>Quitar verificación</button>
            )}
          </div>

          {p.verification_status === 'pendiente' && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <StatusPill status="pendiente" />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {p.dni_proof_path && <button className="mini-btn" onClick={() => handleView(p.dni_proof_path!)}>Ver DNI</button>}
                {p.bank_statement_proof_path && <button className="mini-btn" onClick={() => handleView(p.bank_statement_proof_path!)}>Ver extracto bancario</button>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input
                  placeholder="Motivo si rechazas (opcional)"
                  value={reasons[p.id] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
                  style={{ flex: 1, minWidth: 180 }}
                />
                <button className="mini-btn ok" onClick={() => reviewVerification(p.id, true).then(load)}>Aprobar</button>
                <button className="mini-btn" onClick={() => reviewVerification(p.id, false, reasons[p.id]).then(load)}>Rechazar</button>
              </div>
            </div>
          )}
          {p.verification_status === 'rechazada' && (
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              Verificación rechazada{p.verification_note ? `: ${p.verification_note}` : ''}.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
