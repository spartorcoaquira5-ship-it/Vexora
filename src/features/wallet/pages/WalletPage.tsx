  import { useCallback, useEffect, useState } from 'react';
  import { useAuth } from '@/shared/hooks/useAuth';
  import {
    createRecharge,
    listMovements,
    listMyRecharges,
    uploadProof,
    getProofSignedUrl,
  } from '../api/wallet';
  import CardTestModal from '../components/CardTestModal';
  import type { WalletMovement, Recharge } from '@/shared/types/db';
  import { money } from '@/shared/lib/format';
  import { StatusPill } from '@/shared/components/StatusPill';
  import { EmptyState } from '@/shared/components/EmptyState';

  const MIN = 10;
  const MAX = 500;
  type PaymentMethod = 'yape' | 'binance' | 'tarjeta';

  const METHODS = [
    { id: 'yape', label: 'Yape', icon: 'Y', background: '#7020A0' },
    { id: 'binance', label: 'Binance ID', icon: '₿', background: '#F0B90B' },
    { id: 'tarjeta', label: 'Tarjeta', icon: '▣', background: '#FFCC00' },
  ] as const;

  function methodLabel(method: string): string {
    if (method === 'yape') return 'Yape';
    if (method === 'binance') return 'Binance ID';
    if (method === 'tarjeta') return 'Tarjeta';
    return method;
  }

  export default function WalletPage() {
    const { profile } = useAuth();
    const [movements, setMovements] = useState<WalletMovement[]>([]);
    const [recharges, setRecharges] = useState<Recharge[]>([]);
    const [method, setMethod] = useState<PaymentMethod>('yape');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [pendingUploadId, setPendingUploadId] = useState<string | null>(null);
    const [showCardModal, setShowCardModal] = useState(false);
    const [cardAmount, setCardAmount] = useState(0);

    const load = useCallback(async () => {
      try {
        const [movementData, rechargeData] = await Promise.all([
          listMovements(),
          listMyRecharges(),
        ]);
        setMovements(movementData);
        setRecharges(rechargeData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la billetera.');
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      void load();
    }, [load]);

    function validAmount(): number | null {
      const value = Number(amount);
      if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
        setError('Ingresa un monto válido.');
        return null;
      }
      if (value < MIN || value > MAX) {
        setError(`El monto debe estar entre S/ ${MIN} y S/ ${MAX}.`);
        return null;
      }
      if (Math.round(value * 100) !== value * 100) {
        setError('El monto puede tener como máximo dos decimales.');
        return null;
      }
      return value;
    }

    async function handleCreate() {
      setError(null);
      const value = validAmount();
      if (value === null) return;

      if (method === 'tarjeta') {
        setCardAmount(value);
        setShowCardModal(true);
        return;
      }

      setSaving(true);
      try {
        const id = await createRecharge(value, method);
        setPendingUploadId(id);
        setAmount('');
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo crear la recarga.');
      } finally {
        setSaving(false);
      }
    }

    async function handleFile(rechargeId: string, file: File) {
      if (!profile) {
        setError('Debes iniciar sesión para subir comprobantes.');
        return;
      }
      setError(null);
      setUploadingId(rechargeId);
      try {
        await uploadProof(rechargeId, file, profile.id);
        setPendingUploadId(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante.');
      } finally {
        setUploadingId(null);
      }
    }

    async function handleView(path: string) {
      setError(null);
      try {
        const url = await getProofSignedUrl(path);
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir el comprobante.');
      }
    }

    return (
      <div>
        <h1 style={{ margin: '0 0 4px' }}>Billetera</h1>

        <div style={{
          background: 'var(--yellow)', borderRadius: 14, padding: '20px 24px',
          margin: '16px 0 24px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#5C4200' }}>Saldo disponible</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111' }}>
              {money(profile?.wallet_balance ?? 0)}
            </div>
          </div>
          <span aria-hidden="true" style={{ fontSize: 30, color: '#5C4200' }}>▣</span>
        </div>

        <div className="panel-card">
          <h3>Cargar saldo</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={method === option.id}
                onClick={() => {
                  setMethod(option.id);
                  setError(null);
                  setPendingUploadId(null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '11px 15px', borderRadius: 12, cursor: 'pointer',
                  background: method === option.id ? 'rgba(255,204,0,.10)' : 'var(--card)',
                  border: method === option.id ? '1px solid var(--yellow)' : '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <span aria-hidden="true" style={{
                  display: 'grid', placeItems: 'center', width: 30, height: 30,
                  borderRadius: 8, fontWeight: 800, background: option.background,
                  color: option.id === 'yape' ? '#fff' : '#111',
                }}>
                  {option.icon}
                </span>
                {option.label}
              </button>
            ))}
          </div>


          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="wallet-amount">Monto a cargar (S/ {MIN} – S/ {MAX})</label>
            <input
              id="wallet-amount" type="number" min={MIN} max={MAX} step="0.01"
              value={amount} onChange={(event) => setAmount(event.target.value)}
              placeholder="Ej. 50" disabled={saving}
            />
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <button
            className="primary" type="button"
            style={{ maxWidth: 280, marginTop: 12 }}
            disabled={saving}
            onClick={() => void handleCreate()}
          >
            {saving ? 'Procesando...' : method === 'tarjeta' ? 'Continuar con tarjeta' : 'Solicitar recarga'}
          </button>

          {pendingUploadId && method !== 'tarjeta' && (
            <div style={{
              background: 'var(--yellow-light)', borderRadius: 10,
              padding: 12, marginTop: 14, fontSize: 13,
            }}>
              Solicitud creada. Sube el comprobante para que el administrador revise el pago.
              <div style={{ marginTop: 8 }}>
                <input
                  type="file" accept="image/*,.pdf" disabled={uploadingId !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleFile(pendingUploadId, file);
                  }}
                />
                {uploadingId === pendingUploadId && <span> Subiendo...</span>}
              </div>
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 15, marginTop: 24 }}>Mis recargas</h2>
        {loading ? (
          <p style={{ color: 'var(--text-2)' }}>Cargando recargas...</p>
        ) : recharges.length === 0 ? (
          <EmptyState text="Aún no solicitaste recargas." />
        ) : (
          recharges.map((recharge) => (
            <div key={recharge.id} className="row-item">
              <span>{money(recharge.amount)} · {methodLabel(recharge.method)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {!recharge.proof_url && recharge.status === 'pendiente' && (
                  <input
                    type="file" accept="image/*,.pdf" disabled={uploadingId !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFile(recharge.id, file);
                    }}
                  />
                )}
                {uploadingId === recharge.id && <span>Subiendo...</span>}
                {recharge.proof_url && (
                  <button
                    type="button" className="mini-btn"
                    onClick={() => void handleView(recharge.proof_url!)}
                  >
                    Ver comprobante
                  </button>
                )}
                <StatusPill status={recharge.status} />
              </span>
            </div>
          ))
        )}

        <h2 style={{ fontSize: 15, marginTop: 24 }}>Movimientos</h2>
        {loading ? (
          <p style={{ color: 'var(--text-2)' }}>Cargando movimientos...</p>
        ) : movements.length === 0 ? (
          <EmptyState text="Sin movimientos todavía." />
        ) : (
          movements.map((movement) => (
            <div key={movement.id} className="row-item">
              <span>{movement.description ?? movement.type}</span>
              <span style={{
                color: movement.amount >= 0 ? 'var(--green)' : 'var(--danger)',
                fontWeight: 600,
              }}>
                {movement.amount >= 0 ? '+ ' : '- '}{money(Math.abs(movement.amount))}
              </span>
            </div>
          ))
        )}

        {showCardModal && (
          <CardTestModal
            amount={cardAmount}
            onClose={() => setShowCardModal(false)}
          />
        )}
      </div>
    );
  }