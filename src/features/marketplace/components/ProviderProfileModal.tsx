import { useEffect, useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { listProviderReviews, getProviderPublicInfo, type Review } from '../api/reviews';
import { formatDate } from '@/shared/lib/format';

export function ProviderProfileModal({ providerId, onClose }: { providerId: string | null; onClose: () => void }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getProviderPublicInfo>> | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<'all' | 'pos' | 'neg'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!providerId) return;
    setLoading(true);
    Promise.all([getProviderPublicInfo(providerId), listProviderReviews(providerId)])
      .then(([i, r]) => { setInfo(i); setReviews(r); })
      .finally(() => setLoading(false));
  }, [providerId]);

  const filtered = reviews.filter((r) => filter === 'all' || (filter === 'pos' ? r.rating >= 4 : r.rating <= 3));

  return (
    <Modal open={!!providerId} onClose={onClose} maxWidth={460}>
      {loading && <p style={{ color: 'var(--text-2)' }}>Cargando...</p>}
      {info && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
              {info.business_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{info.business_name}</h2>
              {info.verified && <span style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 600 }}>✓ Verificado</span>}
            </div>
          </div>
          {info.bio && <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{info.bio}</p>}

          <div style={{ display: 'flex', gap: 20, padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '12px 0' }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}><strong style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{info.rating_avg.toFixed(1)}</strong>Promedio</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}><strong style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{info.rating_count}</strong>Valoraciones</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}><strong style={{ display: 'block', fontSize: 17, color: 'var(--text)' }}>{info.sales_count}</strong>Ventas</div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['all', 'pos', 'neg'] as const).map((f) => (
              <button
                key={f}
                className="mini-btn"
                style={filter === f ? { background: 'var(--text)', color: 'var(--bg)' } : {}}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'pos' ? 'Positivos' : 'Negativos'}
              </button>
            ))}
          </div>

          {filtered.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>No hay comentarios en esta categoría.</p>}
          {filtered.map((r) => (
            <div
              key={r.id}
              style={{
                borderLeft: `3px solid ${r.rating >= 4 ? 'var(--green)' : 'var(--danger)'}`,
                background: r.rating >= 4 ? 'var(--green-light)' : 'var(--danger-light)',
                borderRadius: 10, padding: 12, marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <strong>{r.profiles?.full_name ?? 'Cliente'}</strong>
                <span style={{ color: 'var(--yellow-dark)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
              </div>
              <p style={{ fontSize: 14, margin: '0 0 6px' }}>{r.comment}</p>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDate(r.created_at)}</span>
              {r.provider_reply && (
                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)' }}>
                  <strong>Respuesta del proveedor:</strong> {r.provider_reply}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
