
import { useEffect, useState } from 'react';
import {
  listAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  markWithdrawalPaid,
} from '../api/admin';
import { money, formatDateTime } from '@/shared/lib/format';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';

interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  providers?: {
    business_name: string;
  }[];
  withdrawal_methods?: {
    type: string;
    details: Record<string, string>;
  }[];
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [lastCode, setLastCode] = useState<string | null>(null);

  function load() {
    listAllWithdrawals()
      .then((w) => setWithdrawals(w as WithdrawalRow[]))
      .catch((err) => {
        console.error('Error al cargar retiros:', err);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function methodLabel(w: WithdrawalRow) {
    const m = w.withdrawal_methods?.[0];

    if (!m) return '—';

    if (m.type === 'cuenta_bancaria') {
      return `${m.details.bank ?? 'Banco'} ****${(m.details.acc ?? '').slice(-4)}`;
    }

    return `${m.type} ***${(m.details.phone ?? '').slice(-3)}`;
  }

  async function handlePaid(id: string) {
    const code = await markWithdrawalPaid(id);
    setLastCode(code);
    load();
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>
        Retiros de proveedores
      </h1>

      <p
        style={{
          color: 'var(--text-2)',
          marginBottom: 20,
        }}
      >
        Tú transfieres manualmente y marcas el estado.
      </p>

      {lastCode && (
        <div
          style={{
            background: 'var(--green-light)',
            color: 'var(--green-dark)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Código generado para el proveedor:{' '}
          <strong>{lastCode}</strong>
        </div>
      )}

      {withdrawals.length === 0 ? (
        <EmptyState text="No hay solicitudes de retiro." />
      ) : (
        withdrawals.map((w) => (
          <div key={w.id} className="panel-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <strong>{money(w.amount)}</strong>
              <StatusPill status={w.status} />
            </div>

            <div
              style={{
                fontSize: 12,
                color: 'var(--text-2)',
                marginBottom: 10,
              }}
            >
              {w.providers?.[0]?.business_name ?? 'Proveedor'} ·{' '}
              {methodLabel(w)} ·{' '}
              {formatDateTime(w.created_at)}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {w.status === 'pendiente' && (
                <>
                  <button
                    className="mini-btn ok"
                    onClick={() => approveWithdrawal(w.id).then(load)}
                  >
                    Aprobar
                  </button>

                  <button
                    className="mini-btn"
                    onClick={() => rejectWithdrawal(w.id).then(load)}
                  >
                    Rechazar
                  </button>
                </>
              )}

              {w.status === 'aprobado' && (
                <>
                  <button
                    className="mini-btn ok"
                    onClick={() => handlePaid(w.id)}
                  >
                    Marcar pagado
                  </button>

                  <button
                    className="mini-btn"
                    onClick={() => rejectWithdrawal(w.id).then(load)}
                  >
                    Rechazar
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
