
import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  listMyMethods,
  addMethod,
  listMyWithdrawals,
  requestWithdrawal,
  redeemCode,
} from '../api/withdrawals';
import { getBalances } from '../api/provider';
import type {
  WithdrawalMethod,
  Withdrawal,
} from '@/shared/types/db';
import { money, formatDate } from '@/shared/lib/format';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';
import './withdrawals.css';

type MethodType = 'yape' | 'plin' | 'cuenta_bancaria';

function methodName(type: string) {
  if (type === 'yape') return 'Yape';
  if (type === 'plin') return 'Plin';
  return 'Cuenta bancaria';
}

function methodDetails(method: WithdrawalMethod) {
  const d = method.details;
  if (method.type === 'cuenta_bancaria') {
    return `${d.bank ?? ''} · ${d.acc ?? ''}`;
  }
  return d.phone ?? '';
}

export default function WithdrawalsPage() {
  const { profile } = useAuth();

  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [disponible, setDisponible] = useState(0);

  const [methodType, setMethodType] = useState<MethodType>('yape');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState('');
  const [acc, setAcc] = useState('');

  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [redeemInput, setRedeemInput] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    if (!profile) return;

    setLoading(true);
    setLoadError(null);

    const results = await Promise.allSettled([
      listMyMethods(profile.id),
      listMyWithdrawals(),
      getBalances(profile.id),
    ]);

    const [methodsResult, withdrawalsResult, balanceResult] = results;
    const failed: string[] = [];

    if (methodsResult.status === 'fulfilled') {
      const loaded = methodsResult.value;
      setMethods(loaded);
      setSelectedMethod((current) =>
        loaded.some((m) => m.id === current)
          ? current
          : (loaded[0]?.id ?? '')
      );
    } else {
      failed.push('métodos de pago');
    }

    if (withdrawalsResult.status === 'fulfilled') {
      setWithdrawals(withdrawalsResult.value);
    } else {
      failed.push('historial de retiros');
    }

    if (balanceResult.status === 'fulfilled') {
      setDisponible(balanceResult.value.disponible);
    } else {
      failed.push('saldo disponible');
    }

    if (failed.length) {
      setLoadError(
        `No se pudo cargar: ${failed.join(', ')}. Revisa los permisos de acceso.`
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!profile?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleAddMethod() {
    if (!profile || saving) return;

    setError(null);
    setNotice(null);

    const details: Record<string, string> =
      methodType === 'cuenta_bancaria'
        ? { bank: bank.trim(), acc: acc.trim() }
        : { phone: phone.trim() };

    if (methodType === 'cuenta_bancaria') {
      if (!details.bank || !details.acc) {
        setError('Completa el banco y número de cuenta.');
        return;
      }
    } else if (!/^\d{9}$/.test(details.phone)) {
      setError('Ingresa un celular válido de 9 dígitos.');
      return;
    }

    setSaving(true);

    try {
      await addMethod(profile.id, methodType, details);

      setPhone('');
      setBank('');
      setAcc('');
      setNotice('Método de pago guardado correctamente.');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el método de pago.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRequest() {
    if (requesting || loading) return;

    setError(null);
    setNotice(null);

    const amt = Number(amount);

    if (!selectedMethod || !methods.some((m) => m.id === selectedMethod)) {
      setError('Selecciona un método de retiro válido.');
      return;
    }

    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }

    if (amt > disponible) {
      setError(
        `Tu saldo disponible es ${money(disponible)}.`
      );
      return;
    }

    setRequesting(true);

    try {
      await requestWithdrawal(amt, selectedMethod);
      setAmount('');
      setNotice('Solicitud de retiro enviada correctamente.');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo solicitar el retiro.'
      );
    } finally {
      setRequesting(false);
    }
  }

  async function handleRedeem() {
    if (redeeming) return;

    setError(null);
    setNotice(null);

    const code = redeemInput.trim();

    if (!code) {
      setError('Ingresa un código válido.');
      return;
    }

    setRedeeming(true);

    try {
      await redeemCode(code);
      setRedeemInput('');
      setNotice('Código procesado correctamente.');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar el código.'
      );
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <main className="withdrawals">
      <header className="withdrawals__header">
        <div>
          <span className="withdrawals__eyebrow">
            PANEL DE PROVEEDOR
          </span>
          <h1>Mis retiros</h1>
          <p>Administra tus ganancias y métodos de pago.</p>
        </div>

        <button
          className="withdrawals__refresh"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {loadError && (
        <div className="withdrawals__alert" role="alert">
          {loadError}
        </div>
      )}

      {error && (
        <div className="withdrawals__alert" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="withdrawals__notice" role="status">
          {notice}
        </div>
      )}

      <section className="withdrawals__summary">
        <div className="withdrawals__balance">
          <span>SALDO DISPONIBLE</span>
          <strong>{money(disponible)}</strong>
          <p>Fondos disponibles para solicitar un retiro.</p>
        </div>

        <div className="withdrawals__stat">
          <span>MÉTODOS REGISTRADOS</span>
          <strong>{methods.length}</strong>
          <p>Opciones de pago guardadas</p>
        </div>

        <div className="withdrawals__stat">
          <span>SOLICITUDES</span>
          <strong>{withdrawals.length}</strong>
          <p>Retiros registrados en tu historial</p>
        </div>
      </section>

      <div className="withdrawals__layout">
        <section className="withdrawals__card">
          <div className="withdrawals__section-head">
            <div>
              <h2>Solicitar retiro</h2>
              <p>Envía tus ganancias a un método registrado.</p>
            </div>
          </div>

          <div className="withdrawals__fields">
            <div className="withdrawals__field">
              <label htmlFor="withdrawal-amount">
                Monto a retirar (S/)
              </label>
              <input
                id="withdrawal-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="withdrawals__field">
              <label htmlFor="withdrawal-method">
                Método de pago
              </label>
              <select
                id="withdrawal-method"
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                disabled={!methods.length}
              >
                {!methods.length && (
                  <option value="">Sin métodos disponibles</option>
                )}
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {methodName(m.type)} · {methodDetails(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="withdrawals__primary"
            onClick={handleRequest}
            disabled={
              requesting ||
              loading ||
              !selectedMethod ||
              disponible <= 0
            }
          >
            {requesting ? 'Procesando...' : 'Solicitar retiro'}
          </button>

          <p className="withdrawals__hint">
            Solo puedes solicitar montos dentro de tu saldo disponible.
          </p>
        </section>

        <section className="withdrawals__card">
          <div className="withdrawals__section-head">
            <div>
              <h2>Métodos de pago</h2>
              <p>Registra dónde deseas recibir tus fondos.</p>
            </div>
          </div>

          {methods.length > 0 && (
            <div className="withdrawals__methods">
              {methods.map((m) => (
                <div key={m.id} className="withdrawals__method">
                  <span className="withdrawals__method-icon">
                    {m.type === 'cuenta_bancaria' ? 'B' : 'S/'}
                  </span>
                  <div>
                    <strong>{methodName(m.type)}</strong>
                    <small>{methodDetails(m)}</small>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="withdrawals__fields">
            <div className="withdrawals__field">
              <label htmlFor="withdrawal-type">Tipo de método</label>
              <select
                id="withdrawal-type"
                value={methodType}
                onChange={(e) =>
                  setMethodType(e.target.value as MethodType)
                }
              >
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="cuenta_bancaria">
                  Cuenta bancaria
                </option>
              </select>
            </div>

            {methodType === 'cuenta_bancaria' ? (
              <>
                <div className="withdrawals__field">
                  <label htmlFor="withdrawal-bank">Banco</label>
                  <input
                    id="withdrawal-bank"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="Nombre del banco"
                  />
                </div>

                <div className="withdrawals__field">
                  <label htmlFor="withdrawal-account">
                    Número de cuenta
                  </label>
                  <input
                    id="withdrawal-account"
                    value={acc}
                    onChange={(e) => setAcc(e.target.value)}
                    placeholder="Número de cuenta"
                  />
                </div>
              </>
            ) : (
              <div className="withdrawals__field">
                <label htmlFor="withdrawal-phone">
                  Número de celular
                </label>
                <input
                  id="withdrawal-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="987654321"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="withdrawals__secondary"
            onClick={handleAddMethod}
            disabled={saving}
          >
            {saving ? 'Guardando...' : '+ Agregar método'}
          </button>
        </section>
      </div>

      <section className="withdrawals__card withdrawals__history">
        <div className="withdrawals__section-head">
          <div>
            <h2>Historial de retiros</h2>
            <p>Consulta el estado de tus solicitudes.</p>
          </div>
          <span className="withdrawals__count">
            {withdrawals.length} registros
          </span>
        </div>

        {withdrawals.length === 0 ? (
          <EmptyState text="Aún no tienes solicitudes de retiro." />
        ) : (
          <div className="withdrawals__history-list">
            {withdrawals.map((w) => (
              <div key={w.id} className="withdrawals__history-row">
                <div>
                  <strong>{money(w.amount)}</strong>
                  <small>{formatDate(w.created_at)}</small>
                </div>
                <StatusPill status={w.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      <details className="withdrawals__advanced">
        <summary>Opciones adicionales de retiro</summary>
        <div className="withdrawals__advanced-body">
          <h3>Canjear código de retiro</h3>
          <p>
            Utiliza esta opción únicamente si recibiste
            un código válido del sistema.
          </p>
          <div className="withdrawals__redeem">
            <input
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value)}
              placeholder="Ingresa tu código"
            />
            <button
              type="button"
              onClick={handleRedeem}
              disabled={redeeming}
            >
              {redeeming ? 'Procesando...' : 'Canjear'}
            </button>
          </div>
        </div>
      </details>
    </main>
  );
}
