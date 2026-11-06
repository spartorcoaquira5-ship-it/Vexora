
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { getBalances } from '../api/provider';
import { listMySales, type Sale } from '../api/sales';
import {
  listMyOffers,
  stockForOffer,
  type MyOffer,
} from '../api/inventory';
import './provider-dashboard.css';

type Balances = {
  retenido: number;
  disponible: number;
  reservado: number;
  retirado: number;
};

type OfferStock = {
  offer: MyOffer;
  stock: number;
};

const currency = (value: number) =>
  new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(value);

const dateFormat = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

export default function ProviderDashboardPage() {
  const { profile } = useAuth();

  const [balances, setBalances] = useState<Balances | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [offers, setOffers] = useState<OfferStock[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stockError, setStockError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDashboard(providerId: string) {
      setLoading(true);
      setError('');
      setStockError(false);

      try {
        const [balanceData, salesData, offersData] =
          await Promise.all([
            getBalances(providerId),
            listMySales(),
            listMyOffers(providerId),
          ]);

        const stockResults = await Promise.all(
          offersData.map(async (offer) => {
            // stockForOffer devuelve 0 si falla su consulta.
            // No podemos distinguir ese caso desde esta API.
            const stock = await stockForOffer(offer.id);
            return { offer, stock };
          }),
        );

        if (cancelled) return;

        setBalances(balanceData);
        setSales(salesData);
        setOffers(stockResults);
      } catch (err) {
        if (cancelled) return;

        console.error('Error cargando dashboard:', err);
        setError('No se pudieron cargar los datos del panel.');
        setBalances(null);
        setSales([]);
        setOffers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard(profile.id);

    return () => {
      cancelled = true;
    };
  }, [profile?.id, refresh]);

  const totalSales = sales.length;

  const totalIncome = sales.reduce(
    (sum, sale) => sum + Number(sale.provider_amount ?? 0),
    0,
  );

  const totalStock = offers.reduce(
    (sum, item) => sum + Number(item.stock ?? 0),
    0,
  );

  const lowStock = offers.filter(
    (item) => item.stock > 0 && item.stock <= 2,
  );

  const outOfStock = offers.filter(
    (item) => item.stock === 0,
  );

  return (
    <div className="pd">
      <div className="pd-header">
        <div>
          <div className="pd-eyebrow">PANEL DE VENDEDOR</div>
          <h1>Mi Dashboard</h1>
          <p>
            Controla tu negocio, ventas e inventario desde un solo lugar.
          </p>
        </div>

        <button
          type="button"
          className="pd-refresh"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {loading ? 'Actualizando...' : '↻ Actualizar'}
        </button>
      </div>

      {loading ? (
        <div className="pd-message">
          Cargando información de tu negocio...
        </div>
      ) : error ? (
        <div className="pd-message pd-error">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <section className="pd-stats">
            <div className="pd-stat">
              <span className="pd-stat-label">Saldo disponible</span>
              <strong>{currency(Number(balances?.disponible ?? 0))}</strong>
              <small>Disponible para retirar</small>
            </div>

            <div className="pd-stat">
              <span className="pd-stat-label">Saldo retenido</span>
              <strong>{currency(Number(balances?.retenido ?? 0))}</strong>
              <small>Fondos en retención</small>
            </div>

            <div className="pd-stat">
              <span className="pd-stat-label">Ventas registradas</span>
              <strong>{totalSales}</strong>
              <small>Órdenes consultadas</small>
            </div>

            <div className="pd-stat">
              <span className="pd-stat-label">Ingresos por ventas</span>
              <strong>{currency(totalIncome)}</strong>
              <small>Importe del proveedor, no saldo disponible</small>
            </div>
          </section>

          <section className="pd-section">
            <div className="pd-section-head">
              <div>
                <h2>Accesos rápidos</h2>
                <p>Gestiona las operaciones principales de tu negocio.</p>
              </div>
            </div>

            <div className="pd-actions">
              <Link to="/inventario" className="pd-action">
                <span className="pd-action-icon">▣</span>
                <strong>Mi inventario</strong>
                <small>Administrar productos y cuentas</small>
                <span className="pd-action-arrow">→</span>
              </Link>

              <Link to="/ventas" className="pd-action">
                <span className="pd-action-icon">◈</span>
                <strong>Mis ventas</strong>
                <small>Consultar ventas realizadas</small>
                <span className="pd-action-arrow">→</span>
              </Link>

              <Link to="/retiros" className="pd-action">
                <span className="pd-action-icon">▤</span>
                <strong>Mis retiros</strong>
                <small>Administrar solicitudes</small>
                <span className="pd-action-arrow">→</span>
              </Link>

              <Link to="/reclamos" className="pd-action">
                <span className="pd-action-icon">◇</span>
                <strong>Reclamos</strong>
                <small>Consultar incidencias</small>
                <span className="pd-action-arrow">→</span>
              </Link>
            </div>
          </section>

          <div className="pd-columns">
            <section className="pd-section pd-panel">
              <div className="pd-section-head">
                <div>
                  <h2>Últimas ventas</h2>
                  <p>Movimientos recientes de tu negocio.</p>
                </div>
                <Link to="/ventas">Ver todas →</Link>
              </div>

              {sales.length === 0 ? (
                <div className="pd-empty">
                  Todavía no tienes ventas registradas.
                </div>
              ) : (
                <div className="pd-sales">
                  {sales.slice(0, 5).map((sale) => (
                    <div className="pd-sale" key={sale.id}>
                      <div className="pd-sale-icon">◈</div>

                      <div className="pd-sale-info">
                        <strong>
                          {sale.products?.name ?? 'Producto'}
                        </strong>
                        <small>
                          {sale.product_durations?.label ?? 'Venta'}
                          {' · '}
                          {dateFormat(sale.created_at)}
                        </small>
                        <span>{sale.financial_status}</span>
                      </div>

                      <strong className="pd-sale-amount">
                        {currency(Number(sale.provider_amount ?? 0))}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="pd-section pd-panel">
              <div className="pd-section-head">
                <div>
                  <h2>Estado del inventario</h2>
                  <p>Resumen de tus ofertas publicadas.</p>
                </div>
                <Link to="/inventario">Gestionar →</Link>
              </div>

              <div className="pd-inventory-summary">
                <div>
                  <span>Ofertas</span>
                  <strong>{offers.length}</strong>
                </div>
                <div>
                  <span>Unidades disponibles</span>
                  <strong>{totalStock}</strong>
                </div>
              </div>

              {stockError && (
                <p className="pd-warning">
                  No se pudo comprobar todo el inventario.
                </p>
              )}

              {offers.length === 0 ? (
                <div className="pd-empty">
                  Aún no tienes ofertas publicadas.
                </div>
              ) : (
                <div className="pd-inventory-list">
                  {offers.slice(0, 6).map(({ offer, stock }) => (
                    <div className="pd-inventory-item" key={offer.id}>
                      <div>
                        <strong>
                          {offer.products?.name ?? 'Producto'}
                        </strong>
                        <small>
                          {offer.product_durations?.label ?? 'Duración'}
                        </small>
                      </div>

                      <span
                        className={`pd-stock ${
                          stock === 0
                            ? 'pd-stock-empty'
                            : stock <= 2
                              ? 'pd-stock-low'
                              : 'pd-stock-ok'
                        }`}
                      >
                        {stock} disponibles
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {lowStock.length > 0 && (
                <p className="pd-warning">
                  {lowStock.length} oferta(s) con pocas unidades.
                </p>
              )}

              {outOfStock.length > 0 && (
                <p className="pd-warning">
                  {outOfStock.length} oferta(s) con stock reportado en cero.
                </p>
              )}
            </section>
          </div>

          <div className="pd-footer">
            <span>VEXORA · Centro de operaciones del vendedor</span>
            <Link to="/perfil-proveedor">Configurar mi perfil →</Link>
          </div>
        </>
      )}
    </div>
  );
}
