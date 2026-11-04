import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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
import './wallet.css';

const MIN = 10;
const MAX = 500;
type PaymentMethod = 'yape' | 'binance' | 'tarjeta';

const METHODS: { id: PaymentMethod; label: string; description: string }[] = [
  { id: 'yape', label: 'Yape', description: 'Transferencia' },
  { id: 'binance', label: 'Binance ID', description: 'Criptomonedas' },
  { id: 'tarjeta', label: 'Tarjeta', description: 'Débito o crédito' },
];

function methodLabel(method: string): string {
  if (method === 'yape') return 'Yape';
  if (method === 'binance') return 'Binance ID';
  if (method === 'tarjeta') return 'Tarjeta';
  return method;
}

function Icon({ name, size = 20 }: { name: 'wallet' | 'eye' | 'eye-off' | 'arrow-down' | 'arrow-up' | 'receipt' | 'card' | 'check' | 'shield'; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    wallet: <><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 10h18M7 6V4a2 2 0 0 1 2-2h10"/><path d="M16 15h2"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    'eye-off': <><path d="M3 3l18 18M10.6 6.1A12 12 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3.1 3.6M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a11 11 0 0 0 4-.7"/><path d="M10 10a3 3 0 0 0 4 4"/></>,
    'arrow-down': <><path d="M12 4v16m-6-6 6 6 6-6"/></>,
    'arrow-up': <><path d="M12 20V4m-6 6 6-6 6 6"/></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    shield: <><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6l-8-4Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function MethodIcon({ method }: { method: PaymentMethod }) {
  if (method === 'yape') return <span className="vxw-brand vxw-brand-yape" aria-hidden="true">yape</span>;
  if (method === 'binance') return <span className="vxw-brand vxw-brand-binance" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor"><path d="m16 1 5 5-5 5-5-5 5-5ZM6 11l5 5-5 5-5-5 5-5Zm20 0 5 5-5 5-5-5 5-5ZM16 21l5 5-5 5-5-5 5-5Zm0-13 8 8-8 8-8-8 8-8Zm0 6-2 2 2 2 2-2-2-2Z" fillRule="evenodd"/></svg></span>;
  return <span className="vxw-brand vxw-brand-card" aria-hidden="true"><Icon name="card" size={24}/></span>;
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
  const [balanceVisible, setBalanceVisible] = useState(true);

  const load = useCallback(async () => {
    try {
      const [movementData, rechargeData] = await Promise.all([listMovements(), listMyRecharges()]);
      setMovements(movementData);
      setRecharges(rechargeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la billetera.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
    <main className="vxw-page">
      <header className="vxw-heading">
        <div><p className="vxw-eyebrow">FINANZAS / MI CUENTA</p><h1>Mi billetera</h1><p>Gestiona tu saldo y consulta tu actividad.</p></div>
        <span className="vxw-secure"><Icon name="shield" size={15}/> Tu espacio financiero</span>
      </header>

      <section className="vxw-balance" aria-label="Saldo de la billetera">
        <div className="vxw-balance-pattern" aria-hidden="true"/>
        <div className="vxw-balance-top"><span className="vxw-balance-label">Saldo disponible</span><button type="button" className="vxw-icon-button" aria-label={balanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'} aria-pressed={!balanceVisible} onClick={() => setBalanceVisible(v => !v)}><Icon name={balanceVisible ? 'eye' : 'eye-off'} size={19}/></button></div>
        <div className="vxw-balance-value" aria-live="polite">{balanceVisible ? money(profile?.wallet_balance ?? 0) : 'S/ •••••'}</div>
        <div className="vxw-balance-bottom"><span className="vxw-currency"><span className="vxw-currency-dot"/> PEN · Soles peruanos</span><span className="vxw-balance-mark">VEXORA <span>◆</span></span></div>
      </section>

      <div className="vxw-columns">
        <section className="vxw-panel vxw-recharge" aria-labelledby="vxw-recharge-title">
          <div className="vxw-section-heading"><span className="vxw-section-icon"><Icon name="wallet"/></span><div><h2 id="vxw-recharge-title">Agregar fondos</h2><p>Selecciona cómo quieres recargar.</p></div></div>
          <div className="vxw-methods" role="group" aria-label="Método de recarga">
            {METHODS.map(option => <button key={option.id} type="button" aria-pressed={method === option.id} className={`vxw-method ${method === option.id ? 'is-active' : ''}`} onClick={() => { setMethod(option.id); setError(null); setPendingUploadId(null); }}><MethodIcon method={option.id}/><span className="vxw-method-copy"><strong>{option.label}</strong><small>{option.description}</small></span>{method === option.id && <span className="vxw-selected"><Icon name="check" size={12}/></span>}</button>)}
          </div>
          <div className="vxw-form-field"><label htmlFor="wallet-amount">Monto de recarga</label><div className="vxw-input-wrap"><span>S/</span><input id="wallet-amount" type="number" inputMode="decimal" min={MIN} max={MAX} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="50.00" disabled={saving}/></div><p>Importe permitido: S/ {MIN} – S/ {MAX}</p></div>
          {error && <p className="vxw-error" role="alert">{error}</p>}
          <button className="vxw-primary" type="button" disabled={saving} onClick={() => void handleCreate()}>{saving ? 'Procesando...' : method === 'tarjeta' ? 'Continuar con tarjeta' : 'Solicitar recarga'}<span aria-hidden="true">↗</span></button>
          {pendingUploadId && method !== 'tarjeta' && <div className="vxw-upload-notice"><strong>Solicitud creada</strong><p>Sube el comprobante para que el administrador revise el pago.</p><input type="file" aria-label="Subir comprobante de recarga" accept="image/*,.pdf" disabled={uploadingId !== null} onChange={event => { const file = event.target.files?.[0]; if (file) void handleFile(pendingUploadId, file); }}/>{uploadingId === pendingUploadId && <span>Subiendo...</span>}</div>}
        </section>

        <section className="vxw-panel vxw-history" aria-labelledby="vxw-history-title">
          <div className="vxw-section-heading"><span className="vxw-section-icon"><Icon name="receipt"/></span><div><h2 id="vxw-history-title">Mis recargas</h2><p>Solicitudes y comprobantes.</p></div></div>
          {loading ? <p className="vxw-muted">Cargando recargas...</p> : recharges.length === 0 ? <EmptyState text="Aún no solicitaste recargas."/> : <div className="vxw-table-scroll"><table className="vxw-table"><thead><tr><th>Método</th><th className="vxw-number">Monto</th><th>Estado</th><th className="vxw-action-heading">Comprobante</th></tr></thead><tbody>{recharges.map(recharge => <tr key={recharge.id}><td><span className="vxw-table-method"><MethodIcon method={recharge.method === 'binance' || recharge.method === 'tarjeta' ? recharge.method : 'yape'}/><span>{methodLabel(recharge.method)}</span></span></td><td className="vxw-number vxw-amount">{money(recharge.amount)}</td><td><StatusPill status={recharge.status}/></td><td className="vxw-action-cell">{!recharge.proof_url && recharge.status === 'pendiente' && <label className="vxw-file-label">{uploadingId === recharge.id ? 'Subiendo...' : 'Subir archivo'}<input type="file" accept="image/*,.pdf" disabled={uploadingId !== null} onChange={event => { const file = event.target.files?.[0]; if (file) void handleFile(recharge.id, file); }}/></label>}{recharge.proof_url && <button type="button" className="vxw-secondary" onClick={() => void handleView(recharge.proof_url!)}>Ver comprobante</button>}{!recharge.proof_url && recharge.status !== 'pendiente' && <span className="vxw-muted">—</span>}</td></tr>)}</tbody></table></div>}
        </section>
      </div>

      <section className="vxw-panel vxw-movements" aria-labelledby="vxw-movements-title"><div className="vxw-section-heading"><span className="vxw-section-icon"><Icon name="receipt"/></span><div><h2 id="vxw-movements-title">Movimientos recientes</h2><p>Historial de ingresos y compras.</p></div></div>{loading ? <p className="vxw-muted">Cargando movimientos...</p> : movements.length === 0 ? <EmptyState text="Sin movimientos todavía."/> : <div className="vxw-movement-list">{movements.map(movement => <div key={movement.id} className="vxw-movement-row"><span className={`vxw-movement-icon ${movement.amount >= 0 ? 'is-income' : 'is-expense'}`}><Icon name={movement.amount >= 0 ? 'arrow-down' : 'arrow-up'} size={18}/></span><div className="vxw-movement-copy"><strong>{movement.description ?? movement.type}</strong><span>{movement.amount >= 0 ? 'Ingreso a tu billetera' : 'Salida de tu billetera'}</span></div><strong className={`vxw-movement-amount ${movement.amount >= 0 ? 'is-income' : 'is-expense'}`}>{movement.amount >= 0 ? '+ ' : '− '}{money(Math.abs(movement.amount))}</strong></div>)}</div>}</section>

      {showCardModal && <CardTestModal amount={cardAmount} onClose={() => setShowCardModal(false)}/>}
    </main>
  );
}
