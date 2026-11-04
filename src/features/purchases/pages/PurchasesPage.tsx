import { useEffect, useState } from 'react';
import { listMyOrders, getCredentials, hasReview, hasClaim } from '../api/purchases';
import type { Order } from '@/shared/types/db';
import { money, formatDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/components/EmptyState';
import { StatusPill } from '@/shared/components/StatusPill';
import { NewClaimModal } from '@/features/claims/components/NewClaimModal';
import { ReviewModal } from '@/features/marketplace/components/ReviewModal';

interface Row extends Order {
  credentials?: string;
  showCreds?: boolean;
  reviewed?: boolean;
  claimed?: boolean;
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimOrderId, setClaimOrderId] = useState<string | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const data = await listMyOrders();
    const withFlags = await Promise.all(
      data.map(async (o) => ({ ...o, reviewed: await hasReview(o.id), claimed: await hasClaim(o.id) }))
    );
    setOrders(withFlags);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleShowCredentials(orderId: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId && o.showCreds) ? { ...o, showCreds: false } : o));
    const existing = orders.find((o) => o.id === orderId);
    if (existing?.showCreds) return;
    try {
      const creds = await getCredentials(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, credentials: creds, showCreds: true } : o)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudieron obtener las credenciales.');
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 16px' }}>Mis compras</h1>

      {loading && <p style={{ color: 'var(--text-2)' }}>Cargando...</p>}
      {!loading && orders.length === 0 && <EmptyState text="Todavía no tienes compras. Ve al Marketplace y compra algo." />}

      {orders.map((o) => (
        <div key={o.id} className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{o.products?.name} — {o.product_durations?.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{o.providers?.business_name} · {money(o.price)} · {formatDate(o.created_at)}</div>
            </div>
            <StatusPill status={o.status === 'completado' ? 'completado' : o.status} />
          </div>

          <button className="mini-btn" onClick={() => handleShowCredentials(o.id)}>
            {o.showCreds ? 'Ocultar' : 'Ver'} credenciales
          </button>
          {o.showCreds && (
            <div style={{ background: 'var(--yellow-light)', borderRadius: 10, padding: 12, marginTop: 10, fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {o.credentials}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {o.claimed ? (
              <StatusPill status="abierto" />
            ) : (
              <button className="mini-btn" onClick={() => setClaimOrderId(o.id)}>Abrir reclamo</button>
            )}
            {o.reviewed ? (
              <span style={{ fontSize: 12, color: 'var(--green-dark)' }}>★ Ya valoraste</span>
            ) : (
              <button className="mini-btn ok" onClick={() => setReviewOrderId(o.id)}>Dejar reseña</button>
            )}
          </div>
        </div>
      ))}

      <NewClaimModal orderId={claimOrderId} onClose={() => setClaimOrderId(null)} onCreated={load} />
      <ReviewModal orderId={reviewOrderId} onClose={() => setReviewOrderId(null)} onSubmitted={load} />
    </div>
  );
}
