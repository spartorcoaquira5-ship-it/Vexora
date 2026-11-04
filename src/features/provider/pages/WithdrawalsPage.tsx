
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
import type { WithdrawalMethod, Withdrawal } from '@/shared/types/db';
import { money, formatDate } from '@/shared/lib/format';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';

export default function WithdrawalsPage() {
  const { profile } = useAuth();

  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [disponible, setDisponible] = useState(0);

  const [methodType, setMethodType] =
    useState<'yape' | 'plin' | 'cuenta_bancaria'>('yape');

  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState('');
  const [acc, setAcc] = useState('');

  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [redeemInput, setRedeemInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!profile) return;

    const m = await listMyMethods(profile.id);
    setMethods(m);

    if (!selectedMethod && m[0]) {
      setSelectedMethod(m[0].id);
    }

    setWithdrawals(await listMyWithdrawals());

    const b = await getBalances(profile.id);
    setDisponible(b.disponible);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handleAddMethod() {
    if (!profile) return;

    // CORREGIDO: addMethod espera Record<string, string>.
    const details: Record<string, string> =
      methodType === 'cuenta_bancaria'
        ? { bank, acc }
        : { phone };

    await addMethod(profile.id, methodType, details);

    setPhone('');
    setBank('');
    setAcc('');

    load();
  }

  async function handleRequest() {
    setError(null);

    const amt = parseFloat(amount);

    if (!selectedMethod) {
      return setError('Primero guarda un método de retiro.');
    }

    if (!(amt > 0)) {
      return setError('Ingresa un monto válido.');
    }

    if (amt > disponible) {
      return setError(
        `No puedes retirar más de tu saldo disponible (${money(disponible)}).`
      );
    }

    try {
      await requestWithdrawal(amt, selectedMethod);
      setAmount('');
      load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo solicitar el retiro.'
      );
    }
  }

  async function handleRedeem() {
    setError(null);

    try {
      await redeemCode(redeemInput.trim());
      setRedeemInput('');
      load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Código inválido.'
      );
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Retiros</h1>

      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>
        Solo puedes retirar tu saldo disponible:{' '}
        <strong>{money(disponible)}</strong>
      </p>

      <div className="panel-card">
        <h3>Tus métodos de pago</h3>

        {methods.map((m) => (
          <div key={m.id} className="row-item">
            <span>
              {m.type === 'yape'
                ? 'Yape'
                : m.type === 'plin'
                  ? 'Plin'
                  : 'Cuenta bancaria'}{' '}
              ·{' '}
              {m.details.phone ??
                `${m.details.bank} ${m.details.acc}`}
            </span>
          </div>
        ))}

        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Tipo</label>

            <select
              value={methodType}
              onChange={(e) =>
                setMethodType(e.target.value as typeof methodType)
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
              <div className="field">
                <label>Banco</label>
                <input
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                />
              </div>

              <div className="field">
                <label>N° de cuenta</label>
                <input
                  value={acc}
                  onChange={(e) => setAcc(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label>Celular</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
        </div>

        <button
          className="mini-btn ok"
          onClick={handleAddMethod}
        >
          Guardar método
        </button>
      </div>

      <div className="panel-card">
        <h3>Solicitar retiro</h3>

        <div className="form-grid">
          <div className="field">
            <label>Monto (S/)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Método</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <button
          className="primary"
          style={{ maxWidth: 220 }}
          onClick={handleRequest}
        >
          Solicitar retiro
        </button>
      </div>

      <div className="panel-card">
        <h3>Canjear código de retiro</h3>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            placeholder="Ej. 8K4P-29XM"
          />

          <button
            className="mini-btn ok"
            onClick={handleRedeem}
          >
            Canjear
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 500 }}>
        Tus solicitudes
      </h2>

      {withdrawals.length === 0 ? (
        <EmptyState text="Aún no solicitaste retiros." />
      ) : (
        withdrawals.map((w) => (
          <div key={w.id} className="row-item">
            <span>
              {money(w.amount)} · {formatDate(w.created_at)}
            </span>

            <StatusPill status={w.status} />
          </div>
        ))
      )}
    </div>
  );
}
