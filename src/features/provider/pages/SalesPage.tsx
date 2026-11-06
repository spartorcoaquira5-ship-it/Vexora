import { useEffect, useState } from 'react';
import { listMySales, type Sale } from '../api/sales';
import { getBalances } from '../api/provider';
import { useAuth } from '@/shared/hooks/useAuth';
import { money, formatDate } from '@/shared/lib/format';
import { StatusPill } from '@/shared/components/StatusPill';
import { EmptyState } from '@/shared/components/EmptyState';
import './sales.css';

const HOLD_DAYS = 30;
const DAY_MS = 86_400_000;

// Solo presentación: días restantes de retención a partir de la fecha de venta.
// Ajusta `created_at` al nombre real del campo en tu tipo Sale.
function holdInfo(createdAt?: string) {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  const elapsed = Math.floor((Date.now() - start) / DAY_MS);
  const left = Math.max(HOLD_DAYS - elapsed, 0);
  const pct = Math.min(Math.max((elapsed / HOLD_DAYS) * 100, 2), 100);
  const releaseDate = new Date(start + HOLD_DAYS * DAY_MS).toISOString();
  return { left, pct, releaseDate };
}

export default function SalesPage() {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [balances, setBalances] = useState<{ retenido: number; disponible: number; reservado: number; retirado: number } | null>(null);

  useEffect(() => {
    listMySales().then(setSales);
    if (profile) getBalances(profile.id).then(setBalances);
  }, [profile]);

  return (
    <div className="sales">
      <h1 className="sales__title">Mis ventas</h1>
      <p className="sales__sub">Cada venta se acredita retenida; a los 30 días pasa sola a disponible.</p>

      {balances && (
        <div className="kpis">
          <div className="kpi">
            <span className="kpi__label">Ventas</span>
            <strong>{sales.length}</strong>
          </div>
          <div className="kpi">
            <span className="kpi__label"><i className="dot dot--held" />Retenido</span>
            <strong>{money(balances.retenido)}</strong>
          </div>
          <div className="kpi kpi--highlight">
            <span className="kpi__label"><i className="dot dot--available" />Disponible</span>
            <strong>{money(balances.disponible)}</strong>
          </div>
          <div className="kpi">
            <span className="kpi__label"><i className="dot dot--reserved" />Reservado</span>
            <strong>{money(balances.reservado)}</strong>
          </div>
          <div className="kpi">
            <span className="kpi__label"><i className="dot dot--withdrawn" />Retirado</span>
            <strong>{money(balances.retirado)}</strong>
          </div>
        </div>
      )}

      {sales.length === 0 ? (
        <EmptyState text="Todavía no tienes ventas." />
      ) : (
        <>
          <div className="sale-head">
            <span>Producto</span>
            <span>Precio</span>
            <span>Comisión</span>
            <span>Neto</span>
            <span />
          </div>

          {sales.map((s) => {
            const hold = s.financial_status === 'retenido' ? holdInfo((s as any).created_at) : null;
            return (
              <div key={s.id} className="sale">
                <div className="sale-row">
                  <div className="sale__product">
                    <div className="sale__name">
                      {s.products?.name} {s.product_durations?.label}
                    </div>
                    {(s as any).created_at && (
                      <div className="sale__date">{formatDate((s as any).created_at)}</div>
                    )}
                  </div>
                  <div className="sale__muted">{money(s.price)}</div>
                  <div className="sale__muted">− {money(s.commission_amount)}</div>
                  <div className="sale__net">{money(s.provider_amount)}</div>
                  <StatusPill status={s.financial_status} />
                </div>

                {hold && (
                  <div className="hold">
                    <div className="hold__bar">
                      <div className="hold__fill" style={{ width: `${hold.pct}%` }} />
                    </div>
                    <span>
                      Disponible el {formatDate(hold.releaseDate)} · {hold.left === 1 ? 'en 1 día' : `en ${hold.left} días`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}