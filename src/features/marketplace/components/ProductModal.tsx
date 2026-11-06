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
import './product-modal.css';

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

        // Consultar stock pÃºblico real de cada oferta.
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
            'Para comprar necesitas una cuenta. CrÃ©ala o inicia sesiÃ³n y seguimos con tu compra.',
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
    <Modal open={!!product} onClose={onClose} maxWidth={900}>
      {product && (
        <div className="vx-purchase">
          <header className="vx-purchase__header">
            <div className="vx-purchase__brand">V</div>
            <div className="vx-purchase__heading">
              <span className="vx-purchase__eyebrow">VEXORA · MARKETPLACE</span>
              <h2>{product.name}</h2>
              <p>Compara las ofertas disponibles y elige tu proveedor.</p>
            </div>
          </header>

          <section className="vx-purchase__section" aria-label="Duración del servicio">
            <span className="vx-purchase__label">Selecciona la duración</span>
            <div className="vx-purchase__durations">
              {product.product_durations.map((duration) => (
                <button
                  type="button"
                  key={duration.id}
                  className={`vx-purchase__duration ${durationId === duration.id ? 'is-selected' : ''}`}
                  aria-pressed={durationId === duration.id}
                  onClick={() => setDurationId(duration.id)}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </section>

          {session && (
            <div className="vx-purchase__coupon">
              <label htmlFor="vx-purchase-coupon">¿Tienes un cupón?</label>
              <input
                id="vx-purchase-coupon"
                type="text"
                placeholder="Código de descuento (opcional)"
                value={coupon}
                onChange={(event) => setCoupon(event.target.value)}
              />
              <span>El descuento se validará al comprar.</span>
            </div>
          )}

          {error && <p className="vx-purchase__error" role="alert">{error}</p>}
          {loading && <p className="vx-purchase__notice">Cargando ofertas y stock...</p>}
          {!loading && !error && offers.length === 0 && (
            <p className="vx-purchase__notice">Aún no hay proveedores con ofertas para esta duración.</p>
          )}

          <div className="vx-purchase__offers">
            {offers.map((offer) => {
              const stock = stockMap[offer.id] ?? 0;
              const providerName = offer.providers?.business_name ?? 'Proveedor';
              const rating = offer.providers?.rating_avg;
              return (
                <article key={offer.id} className="vx-purchase__offer">
                  <div className="vx-purchase__provider">
                    <div className="vx-purchase__avatar" aria-hidden="true">
                      {providerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="vx-purchase__provider-details">
                      <strong>{providerName}</strong>
                      <span className="vx-purchase__rating">
                        {rating != null ? `★ ${Number(rating).toFixed(1)}` : 'Proveedor nuevo'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="vx-purchase__profile"
                      onClick={() => onOpenProvider(offer.provider_id)}
                    >
                      Ver perfil →
                    </button>
                  </div>
                  <div className="vx-purchase__offer-bottom">
                    <div>
                      <span className="vx-purchase__price-label">Precio de la oferta</span>
                      <div className="vx-purchase__price">{money(offer.price)}</div>
                    </div>
                    <span className={`vx-purchase__stock ${stock < 1 ? 'is-empty' : ''}`}>
                      {stock > 0 ? `${stock} disponibles` : 'Sin stock'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="vx-purchase__buy"
                    disabled={loading || stock < 1 || buying !== null}
                    onClick={() => handleBuy(offer.id)}
                  >
                    {buying === offer.id
                      ? 'Procesando...'
                      : stock < 1
                        ? 'Sin stock'
                        : 'Comprar ahora →'}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}