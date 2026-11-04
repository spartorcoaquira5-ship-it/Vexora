import { useEffect, useState } from 'react';
import { listMySales, type Sale } from '../api/sales';
import { getBalances } from '../api/provider';
import { useAuth } from '@/shared/hooks/useAuth';
import { money, formatDate } from '@/shared/lib/format';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';

export default function SalesPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [balances, setBalances] = useState<{ retenido: number; disponible: number; reservado: number; retirado: number } | null>(null);

  useEffect(() => {
    listMySales().then(setSales);
    if (profile) getBalances(profile.id).then(setBalances);
  }, [profile]);

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Mis ventas</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Cada venta se acredita retenida; a los 30 días pasa sola a disponible.</p>

      {balances && (
        <div className="kpis">
          <div className="kpi"><strong>{sales.length}</strong>Ventas</div>
          <div className="kpi"><strong>{money(balances.retenido)}</strong>Retenido</div>
          <div className="kpi"><strong>{money(balances.disponible)}</strong>Disponible</div>
          <div className="kpi"><strong>{money(balances.reservado)}</strong>Reservado</div>
          <div className="kpi"><strong>{money(balances.retirado)}</strong>Retirado</div>
        </div>
      )}

      {sales.length === 0 ? (
        <EmptyState text="Todavía no tienes ventas." />
      ) : (
        sales.map((s) => (
          <div key={s.id} className="row-item">
            <span>
              {s.products?.name} {s.product_durations?.label}
              <br />
              <span style={{ color: 'var(--text-2)' }}>{money(s.price)} − comisión {money(s.commission_amount)} = <strong>{money(s.provider_amount)}</strong></span>
            </span>
            <StatusPill status={s.financial_status} />
          </div>
        ))
      )}
    </div>
  );
}
