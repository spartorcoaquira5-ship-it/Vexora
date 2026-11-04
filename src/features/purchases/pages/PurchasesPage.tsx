
import { useCallback, useEffect, useState } from 'react';
import {
  listMyOrders,
  getCredentials,
  hasReview,
  hasClaim,
} from '../api/purchases';
import type { Order } from '@/shared/types/db';
import { money, formatDate } from '@/shared/lib/format';
import { EmptyState } from '@/shared/components/EmptyState';
import { StatusPill } from '@/shared/components/StatusPill';
import { NewClaimModal } from '@/features/claims/components/NewClaimModal';
import { ReviewModal } from '@/features/marketplace/components/ReviewModal';
import './PurchasesPage.css';

interface Row extends Order {
  credentials?: string;
  showCreds?: boolean;
  reviewed?: boolean;
  claimed?: boolean;
}

export default function PurchasesPage() {
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimOrderId, setClaimOrderId] = useState<string | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listMyOrders();

      const withFlags = await Promise.all(
        data.map(async (o) => {
          const [reviewed, claimed] = await Promise.all([
            hasReview(o.id),
            hasClaim(o.id),
          ]);

          return {
            ...o,
            reviewed,
            claimed,
            showCreds: false,
          };
        })
      );

      setOrders(withFlags);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus compras.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleShowCredentials(orderId: string) {
    const existing = orders.find((o) => o.id === orderId);

    if (!existing) return;

    if (existing.showCreds) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, showCreds: false, credentials: undefined }
            : o
        )
      );
      return;
    }

    setLoadingCredentials(orderId);

    try {
      const creds = await getCredentials(orderId);

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                credentials: creds,
                showCreds: true,
              }
            : o
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron obtener las credenciales.'
      );
    } finally {
      setLoadingCredentials(null);
    }
  }

  async function handleCopy(orderId: string, credentials: string) {
    try {
      await navigator.clipboard.writeText(credentials);
      setCopiedId(orderId);
    } catch {
      setError('No se pudieron copiar las credenciales.');
    }
  }

  const completed = orders.filter(
    (o) => o.status === 'completado'
  ).length;

  const totalSpent = orders
    .filter((o) => o.status === 'completado')
    .reduce((total, o) => total + Number(o.price || 0), 0);

  return (
    <div className="vexora-purchases">
      <div className="vp-header">
        <div>
          <span className="vp-eyebrow">MI CUENTA / COMPRAS</span>
          <h1>Mis compras</h1>
          <p>
            Consulta tus suscripciones, administra tus accesos
            y solicita ayuda cuando la necesites.
          </p>
        </div>

        <div className="vp-header-icon" aria-hidden="true">
          <svg
            width="27"
            height="27"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 7h12l1 13H5L6 7Z" />
            <path d="M9 9V6a3 3 0 0 1 6 0v3" />
          </svg>
        </div>
      </div>

      <div className="vp-stats">
        <div className="vp-stat">
          <span>Compras realizadas</span>
          <strong>{orders.length}</strong>
          <small>Historial de pedidos</small>
        </div>

        <div className="vp-stat">
          <span>Compras completadas</span>
          <strong className="vp-green">{completed}</strong>
          <small>Accesos adquiridos</small>
        </div>

        <div className="vp-stat">
          <span>Total gastado</span>
          <strong>{money(totalSpent)}</strong>
          <small>Compras completadas</small>
        </div>
      </div>

      <div className="vp-section-heading">
        <div>
          <h2>Historial de compras</h2>
          <p>Todos tus pedidos en un solo lugar.</p>
        </div>

        <button
          type="button"
          className="vp-refresh"
          onClick={() => void load()}
          disabled={loading}
        >
          ↻ Actualizar
        </button>
      </div>

      {error && (
        <div className="vp-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {loading && (
        <div className="vp-loading">
          <div className="vp-spinner" />
          <span>Cargando tus compras...</span>
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="vp-empty">
          <EmptyState text="Todavía no tienes compras. Ve al Marketplace y compra algo." />
        </div>
      )}

      {!loading && (
        <div className="vp-orders">
          {orders.map((o) => {
            const isCompleted = o.status === 'completado';

            return (
              <article key={o.id} className="vp-order-card">
                <div className="vp-order-top">
                  <div className="vp-product-info">
                    <div className="vp-product-icon">
                      {(o.products?.name || 'V')
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <div className="vp-product-text">
                      <h3>
                        {o.products?.name || 'Producto digital'}
                      </h3>

                      <p>
                        {o.product_durations?.label || 'Suscripción'}
                        {' · '}
                        {o.providers?.business_name || 'Proveedor'}
                      </p>
                    </div>
                  </div>

                  <StatusPill status={o.status} />
                </div>

                <div className="vp-order-details">
                  <div>
                    <span>Precio pagado</span>
                    <strong className="vp-price">
                      {money(o.price)}
                    </strong>
                  </div>

                  <div>
                    <span>Fecha de compra</span>
                    <strong>{formatDate(o.created_at)}</strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong>
                      {isCompleted
                        ? 'Compra completada'
                        : o.status}
                    </strong>
                  </div>
                </div>

                <div className="vp-access">
                  <div className="vp-access-heading">
                    <div className="vp-access-title">
                      <span className="vp-lock">🔐</span>
                      <div>
                        <strong>Datos de acceso</strong>
                        <p>
                          Tus credenciales son privadas.
                          Muéstralas solo cuando las necesites.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="vp-credentials-button"
                      onClick={() =>
                        void handleShowCredentials(o.id)
                      }
                      disabled={loadingCredentials === o.id}
                    >
                      {loadingCredentials === o.id
                        ? 'Cargando...'
                        : o.showCreds
                          ? 'Ocultar datos'
                          : 'Ver credenciales'}
                    </button>
                  </div>

                  {o.showCreds && (
                    <div className="vp-credentials">
                      <pre>{o.credentials}</pre>

                      <button
                        type="button"
                        className="vp-copy-button"
                        onClick={() =>
                          void handleCopy(
                            o.id,
                            o.credentials || ''
                          )
                        }
                      >
                        {copiedId === o.id
                          ? '✓ Copiado'
                          : 'Copiar datos'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="vp-order-footer">
                  <div className="vp-actions">
                    {o.claimed ? (
                      <div className="vp-action-status">
                        <StatusPill status="abierto" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="vp-secondary-btn"
                        onClick={() => setClaimOrderId(o.id)}
                      >
                        Abrir reclamo
                      </button>
                    )}

                    {o.reviewed ? (
                      <span className="vp-reviewed">
                        ★ Ya valoraste esta compra
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="vp-primary-btn"
                        onClick={() => setReviewOrderId(o.id)}
                      >
                        ★ Dejar reseña
                      </button>
                    )}
                  </div>

                  <span className="vp-order-id">
                    Pedido #{o.id.slice(0, 8)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <NewClaimModal
        orderId={claimOrderId}
        onClose={() => setClaimOrderId(null)}
        onCreated={() => void load()}
      />

      <ReviewModal
        orderId={reviewOrderId}
        onClose={() => setReviewOrderId(null)}
        onSubmitted={() => void load()}
      />
    </div>
  );
}
