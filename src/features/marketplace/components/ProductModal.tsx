
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/shared/components/Modal';
import {
  listOffersForDuration,
  purchaseOffer,
} from '../api/marketplace';
import { supabase } from '@/shared/lib/supabaseClient';
import type { Product, ProviderOffer } from '@/shared/types/db';
import { money } from '@/shared/lib/format';
import { useAuth } from '@/shared/hooks/useAuth';

export function ProductModal({
  product,
  onClose,
  onOpenProvider,
  onPurchased,
}: {
  product: Product | null;
  onClose: () => void;
  onOpenProvider: (providerId: string) => void;
  onPurchased: () => void;
}) {
  const { session, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [durationId, setDurationId] = useState<string | null>(null);
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [coupon, setCoupon] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setDurationId(product.product_durations[0]?.id ?? null);
      setOffers([]);
      setStockMap({});
      setCoupon('');
      setError(null);
    }
  }, [product]);

  useEffect(() => {
    if (!product || !durationId) return;

    let cancelled = false;

    async function loadOffers() {
      setLoading(true);
      setOffers([]);
      setStockMap({});
      setError(null);

      try {
        const data = await listOffersForDuration(
          product!.id,
          durationId!
        );

        if (cancelled) return;

        setOffers(data);

        // Consultar stock público real de cada oferta.
        const stockResults = await Promise.all(
          data.map(async (offer) => {
            const { data: stock, error: stockError } =
              await supabase.rpc('fn_public_offer_stock', {
                p_offer_id: offer.id,
              });

            if (stockError) {
              throw stockError;
            }

            return {
              offerId: offer.id,
              stock: Number(stock ?? 0),
            };
          })
        );

        if (cancelled) return;

        const nextStock: Record<string, number> = {};

        stockResults.forEach((item) => {
          nextStock[item.offerId] = item.stock;
        });

        setStockMap(nextStock);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar las ofertas.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOffers();

    return () => {
      cancelled = true;
    };
  }, [product, durationId]);

  async function handleBuy(offerId: string) {
    setError(null);

    if (!session) {
      onClose();

      navigate('/register', {
        state: {
          message:
            'Para comprar necesitas una cuenta. Créala o inicia sesión y seguimos con tu compra.',
          returnTo: '/marketplace',
          productId: product?.id,
          durationId,
          offerId,
        },
      });

      return;
    }

    setBuying(offerId);

    try {
      await purchaseOffer(offerId, coupon || undefined);
      await refreshProfile();
      onPurchased();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la compra.'
      );
    } finally {
      setBuying(null);
    }
  }

  return (
    <Modal open={!!product} onClose={onClose} maxWidth={760}>
      {product && (
        <>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>
            {product.name}
          </h2>

          <p
            style={{
              fontSize: 13,
              color: 'var(--text-2)',
              marginBottom: 18,
            }}
          >
            Compara las ofertas de cada proveedor y elige la tuya.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 18,
            }}
          >
            {product.product_durations.map((duration) => (
              <button
                type="button"
                key={duration.id}
                className="mini-btn"
                style={
                  durationId === duration.id
                    ? {
                        background: 'var(--yellow)',
                        color: 'var(--on-yellow)',
                        borderColor: 'var(--yellow)',
                      }
                    : {}
                }
                onClick={() => setDurationId(duration.id)}
              >
                {duration.label}
              </button>
            ))}
          </div>

          {session && (
            <div
              className="field"
              style={{ maxWidth: 280, marginBottom: 16 }}
            >
              <label>¿Tienes un cupón?</label>
              <input
                type="text"
                placeholder="Código (opcional)"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
              />
            </div>
          )}

          {error && <p className="error">{error}</p>}

          {loading && (
            <p style={{ color: 'var(--text-2)' }}>
              Cargando ofertas y stock...
            </p>
          )}

          {!loading && !error && offers.length === 0 && (
            <p style={{ color: 'var(--text-2)' }}>
              Aún no hay proveedores con ofertas para esta duración.
            </p>
          )}

          <div className="offer-grid">
            {offers.map((offer) => {
              const stock = stockMap[offer.id] ?? 0;
              const providerName =
                offer.providers?.business_name ?? 'Proveedor';

              const rating = offer.providers?.rating_avg;

              return (
                <div key={offer.id} className="offer-card">
                  <div
                    onClick={() => onOpenProvider(offer.provider_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: 'var(--green)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {providerName.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                        }}
                      >
                        {providerName}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--yellow)',
                        }}
                      >
                        {rating != null
                          ? `★ ${Number(rating).toFixed(1)}`
                          : 'Proveedor nuevo'}
                      </div>

                      <button
                        type="button"
                        className="mini-btn"
                        style={{ marginTop: 6 }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenProvider(offer.provider_id);
                        }}
                      >
                        Ver perfil →
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 25,
                      fontWeight: 800,
                      marginBottom: 12,
                    }}
                  >
                    {money(offer.price)}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'var(--text-2)',
                      marginBottom: 14,
                    }}
                  >
                    <span>Stock disponible</span>
                    <strong>{stock}</strong>
                  </div>

                  <button
                    type="button"
                    disabled={loading || stock < 1 || buying !== null}
                    onClick={() => handleBuy(offer.id)}
                    style={{
                      width: '100%',
                      background:
                        stock > 0
                          ? 'var(--yellow)'
                          : 'var(--card-2)',
                      color:
                        stock > 0
                          ? 'var(--on-yellow)'
                          : 'var(--text-2)',
                      fontWeight: 700,
                    }}
                  >
                    {buying === offer.id
                      ? 'Procesando...'
                      : stock < 1
                        ? 'Sin stock'
                        : 'Comprar'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
