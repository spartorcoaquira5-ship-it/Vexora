import { useEffect, useState } from 'react';
import {
  listAllRecharges,
  confirmRecharge,
  rejectRecharge,
  getRechargeProofUrl,
  listCardTestAttempts,
} from '../api/admin';
import type { CardTestAttempt } from '../api/admin';
import { money, formatDateTime } from '@/shared/lib/format';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';
interface RechargeRow {
  id: string;
  amount: number;
  method: string;
  status: string;
  proof_url: string | null;
  created_at: string;
  profiles?:
    | { full_name: string }[]
    | { full_name: string }
    | null;
}
type ActiveTab = 'recharges' | 'card_attempts';
export default function AdminRechargesPage() {
  const [activeTab, setActiveTab] =
    useState<ActiveTab>('recharges');
  const [recharges, setRecharges] =
    useState<RechargeRow[]>([]);
  const [cardAttempts, setCardAttempts] =
    useState<(CardTestAttempt & { postal_code?: string | null })[]>([]);
  const [loadingRecharges, setLoadingRecharges] =
    useState(true);
  const [loadingCards, setLoadingCards] =
    useState(true);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [rechargeError, setRechargeError] =
    useState<string | null>(null);
  const [cardError, setCardError] =
    useState<string | null>(null);
  async function loadRecharges() {
    setRechargeError(null);
    try {
      const data = await listAllRecharges();
      setRecharges(data as RechargeRow[]);
    } catch (err) {
      setRechargeError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las recargas.'
      );
    } finally {
      setLoadingRecharges(false);
    }
  }
  async function loadCardAttempts() {
    setCardError(null);
    try {
      const data = await listCardTestAttempts();
      setCardAttempts(data);
    } catch (err) {
      setCardError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los intentos de tarjeta.'
      );
    } finally {
      setLoadingCards(false);
    }
  }
  useEffect(() => {
    void loadRecharges();
    void loadCardAttempts();
  }, []);
  async function handleView(path: string) {
    setRechargeError(null);
    try {
      const url = await getRechargeProofUrl(path);
      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );
    } catch (err) {
      setRechargeError(
        err instanceof Error
          ? err.message
          : 'No se pudo abrir el comprobante.'
      );
    }
  }
  async function handleConfirm(id: string) {
    const approved = window.confirm(
      '¿Confirmas que verificaste el pago y deseas acreditar el saldo?'
    );
    if (!approved) return;
    setRechargeError(null);
    setProcessingId(id);
    try {
      await confirmRecharge(id);
      await loadRecharges();
    } catch (err) {
      setRechargeError(
        err instanceof Error
          ? err.message
          : 'No se pudo confirmar la recarga.'
      );
    } finally {
      setProcessingId(null);
    }
  }
  async function handleReject(id: string) {
    const confirmed = window.confirm(
      '¿Seguro que deseas rechazar esta recarga?'
    );
    if (!confirmed) return;
    setRechargeError(null);
    setProcessingId(id);
    try {
      await rejectRecharge(id);
      await loadRecharges();
    } catch (err) {
      setRechargeError(
        err instanceof Error
          ? err.message
          : 'No se pudo rechazar la recarga.'
      );
    } finally {
      setProcessingId(null);
    }
  }
  function clientName(recharge: RechargeRow): string {
    const profile = recharge.profiles;
    if (Array.isArray(profile)) {
      return profile[0]?.full_name ?? 'Cliente';
    }
    return profile?.full_name ?? 'Cliente';
  }
  function methodLabel(method: string): string {
    if (method === 'yape') return 'Yape';
    if (method === 'binance') return 'Binance ID';
    if (method === 'tarjeta') return 'Tarjeta';
    return method;
  }
  function cardBrandLabel(brand: string): string {
    const normalized = brand.toLowerCase();
    if (normalized === 'visa') return 'Visa';
    if (
      normalized === 'mastercard' ||
      normalized === 'master card'
    ) {
      return 'Mastercard';
    }
    if (
      normalized === 'amex' ||
      normalized === 'american express'
    ) {
      return 'American Express';
    }
    return brand || 'No identificada';
  }
  const tabStyle = (selected: boolean): React.CSSProperties => ({
    padding: '11px 18px',
    borderRadius: 10,
    border: selected
      ? '1px solid #ffd000'
      : '1px solid var(--border, #30343d)',
    background: selected ? '#ffd000' : 'transparent',
    color: selected ? '#111111' : 'var(--text-1, #ffffff)',
    fontWeight: 700,
    cursor: 'pointer',
  });
  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>
        Recargas
      </h1>
      <p
        style={{
          color: 'var(--text-2)',
          marginBottom: 20,
        }}
      >
        Revisa los comprobantes de Yape y Binance ID.
        Los intentos de tarjeta se registran por separado
        y nunca acreditan saldo.
      </p>
      {/* Pestañas */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <button
          type="button"
          style={tabStyle(activeTab === 'recharges')}
          onClick={() => setActiveTab('recharges')}
        >
          Yape / Binance
        </button>
<button
  type="button"
  style={tabStyle(activeTab === 'card_attempts')}
  onClick={() => setActiveTab('card_attempts')}
>
  Tarjetas guardadas
  {cardAttempts.length > 0
    ? ` (${cardAttempts.length})`
    : ''}
</button>
      </div>
      {/* RECARGAS YAPE / BINANCE */}
      {activeTab === 'recharges' && (
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>
              Recargas recibidas
            </h2>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                setLoadingRecharges(true);
                void loadRecharges();
              }}
            >
              Actualizar
            </button>
          </div>
          {rechargeError && (
            <p className="error" role="alert">
              {rechargeError}
            </p>
          )}
          {loadingRecharges ? (
            <p style={{ color: 'var(--text-2)' }}>
              Cargando recargas...
            </p>
          ) : recharges.length === 0 ? (
            <EmptyState text="No hay recargas." />
          ) : (
            recharges.map((recharge) => (
              <div
                key={recharge.id}
                className="panel-card"
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 6,
                  }}
                >
                  <strong>
                    {money(recharge.amount)}
                  </strong>
                  <StatusPill
                    status={recharge.status}
                  />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-2)',
                    marginBottom: 12,
                  }}
                >
                  {clientName(recharge)}
                  {' · '}
                  {methodLabel(recharge.method)}
                  {' · '}
                  {formatDateTime(recharge.created_at)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {recharge.proof_url ? (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() =>
                        void handleView(
                          recharge.proof_url!
                        )
                      }
                    >
                      Ver comprobante
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-2)',
                      }}
                    >
                      Comprobante aún no subido
                    </span>
                  )}
                  {recharge.status === 'pendiente' && (
                    <>
                      <button
                        type="button"
                        className="mini-btn ok"
                        disabled={
                          processingId !== null ||
                          !recharge.proof_url
                        }
                        onClick={() =>
                          void handleConfirm(recharge.id)
                        }
                      >
                        {processingId === recharge.id
                          ? 'Procesando...'
                          : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        className="mini-btn"
                        disabled={
                          processingId !== null
                        }
                        onClick={() =>
                          void handleReject(recharge.id)
                        }
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}
      {/* INTENTOS DE TARJETA */}
      {activeTab === 'card_attempts' && (
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>
              Historial de intentos
            </h2>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                setLoadingCards(true);
                void loadCardAttempts();
              }}
            >
              Actualizar
            </button>
          </div>
          {cardError && (
            <p className="error" role="alert">
              {cardError}
            </p>
          )}
          {loadingCards ? (
            <p style={{ color: 'var(--text-2)' }}>
              Cargando intentos de tarjeta...
            </p>
          ) : cardAttempts.length === 0 ? (
            <EmptyState
              text="Todavía no hay intentos de tarjeta registrados."
            />
          ) : (
            cardAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="panel-card"
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <strong style={{ fontSize: 18 }}>
                    {money(attempt.amount)}
                  </strong>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 14,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: 'var(--text-2)',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      Cliente
                    </div>
                    <strong>
                      {attempt.full_name || 'Cliente'}
                    </strong>
                  </div>
                  <div>
                    <div
                      style={{
                        color: 'var(--text-2)',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      Marca
                    </div>
                    <strong>
                      {cardBrandLabel(
                        attempt.card_brand
                      )}
                    </strong>
                  </div>
                  <div>
                    <div
                      style={{
                        color: 'var(--text-2)',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      Numero de tarjeta
                    </div>
                    <strong
                      style={{
                        letterSpacing: 1.5,
                      }}
                    >
                     {attempt.last_four}
                    </strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 4 }}>
                      CVV
                    </div>
                    <strong>{attempt.postal_code || 'No registrado'}</strong>
                  </div>
                  <div>
                    <div
                      style={{
                        color: 'var(--text-2)',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      Fecha
                    </div>
                    <strong>
                      {formatDateTime(
                        attempt.created_at
                      )}
                    </strong>
                  </div>
                </div>
                <div
                  style={{
                    borderTop:
                      '1px solid var(--border, #30343d)',
                    paddingTop: 12,
                    fontSize: 12,
                    color: 'var(--text-2)',
                  }}
                >
                  Para : 𝙎𝙋𝘼𝙍𝙏𝙊𝙍_𝙏𝙕:{' '}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}