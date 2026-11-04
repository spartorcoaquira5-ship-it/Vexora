import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { listClaims, listClaimMessages, addClaimMessage, resolveClaim } from '../api/claims';
import type { Claim, ClaimMessage } from '@/shared/types/db';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';
import { formatDate } from '@/shared/lib/format';

const REASON_LABEL: Record<string, string> = {
  no_funciona: 'Producto no funciona',
  diferente: 'Producto diferente',
  no_recibido: 'Producto no recibido',
  otro: 'Otro',
};

function ClaimThread({ claim, onResolved }: { claim: Claim; onResolved: () => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ClaimMessage[]>([]);
  const [text, setText] = useState('');

  function load() {
    listClaimMessages(claim.id).then(setMessages);
  }
  useEffect(() => { load(); }, [claim.id]);

  async function handleSend() {
    if (!text.trim()) return;
    await addClaimMessage(claim.id, text.trim());
    setText('');
    load();
  }

  async function handleResolve(type: 'reembolso_cliente' | 'liberar_proveedor') {
    await resolveClaim(claim.id, type);
    onResolved();
  }

  return (
    <div className="panel-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>{claim.orders?.products?.name ?? 'Pedido'}</strong>
        <StatusPill status={claim.status} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>
        {claim.providers?.business_name} · Motivo: {REASON_LABEL[claim.reason] ?? claim.reason} · {formatDate(claim.created_at)}
      </div>

      {messages.map((m) => (
        <div key={m.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', fontSize: 13, marginBottom: 6 }}>
          {m.message}
        </div>
      ))}

      {claim.status !== 'resuelto' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje..." />
          <button className="mini-btn ok" onClick={handleSend}>Enviar</button>
        </div>
      )}

      {profile?.role === 'admin' && claim.status !== 'resuelto' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="mini-btn ok" onClick={() => handleResolve('reembolso_cliente')}>Reembolsar al cliente</button>
          <button className="mini-btn ok" onClick={() => handleResolve('liberar_proveedor')}>Liberar al proveedor</button>
        </div>
      )}
    </div>
  );
}

export default function ClaimsPage() {
  const { profile } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    listClaims().then(setClaims).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const lead =
    profile?.role === 'cliente'
      ? 'Ábrelos desde "Mis compras". El proveedor responde y el administrador resuelve.'
      : profile?.role === 'proveedor'
      ? 'Responde a los reclamos sobre tus ventas. El administrador toma la decisión final.'
      : 'Revisa el hilo y resuelve: reembolso al cliente o liberar el dinero al proveedor.';

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Reclamos</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>{lead}</p>

      {loading && <p style={{ color: 'var(--text-2)' }}>Cargando...</p>}
      {!loading && claims.length === 0 && <EmptyState text="No hay reclamos por aquí." />}
      {claims.map((c) => (
        <ClaimThread key={c.id} claim={c} onResolved={load} />
      ))}
    </div>
  );
}
