
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { getMyProvider } from '../api/provider';
import {
  listActiveProductsForProvider,
  listMyOffers,
  addInventory,
  stockForOffer,
  type MyOffer,
} from '../api/inventory';
import { money } from '@/shared/lib/format';
import './inventory.css';

interface ProductOpt {
  id: string;
  name: string;
  product_durations: {
    id: string;
    label: string;
  }[];
}

type OfferWithStock = MyOffer & {
  stock?: number;
};

export default function InventoryPage() {
  const { profile } = useAuth();

  const [verified, setVerified] = useState<boolean | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [offers, setOffers] = useState<OfferWithStock[]>([]);

  const [productId, setProductId] = useState('');
  const [durationId, setDurationId] = useState('');
  const [price, setPrice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileCount, setProfileCount] = useState('6');

  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'disponibles' | 'agotados'>('todos');

  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;

    setLoading(true);
    setLoadError(null);

    try {
      const [prov, prods, mine] = await Promise.all([
        getMyProvider(),
        listActiveProductsForProvider(),
        listMyOffers(profile.id),
      ]);

      setVerified(prov.verified);
      setProducts(prods as ProductOpt[]);

      setProductId((current) =>
        prods.some((p) => p.id === current)
          ? current
          : prods[0]?.id ?? '',
      );

      const withStock = await Promise.all(
        mine.map(async (offer) => ({
          ...offer,
          stock: await stockForOffer(offer.id),
        })),
      );

      setOffers(withStock);
    } catch (err) {
      console.error('Error cargando inventario:', err);
      setLoadError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el inventario.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const selectedProduct = products.find(
    (p) => p.id === productId,
  );

  useEffect(() => {
    if (
      selectedProduct &&
      !selectedProduct.product_durations.some(
        (d) => d.id === durationId,
      )
    ) {
      setDurationId(
        selectedProduct.product_durations[0]?.id ?? '',
      );
    }
  }, [selectedProduct, durationId]);

  async function handleAdd() {
    if (!profile || saving) return;

    setError(null);
    setSuccess('');

    const priceNum = Number(price);
    const count = Number(profileCount);

    if (
      !productId ||
      !durationId ||
      !Number.isFinite(priceNum) ||
      priceNum <= 0 ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 10 ||
      !email.trim() ||
      !password
    ) {
      setError(
        'Completa producto, duración, precio, perfiles (1-10), correo y contraseña.',
      );
      return;
    }

    setSaving(true);

    try {
      await addInventory({
        providerId: profile.id,
        productId,
        durationId,
        price: priceNum,
        email: email.trim(),
        password,
        profileCount: count,
      });

      setEmail('');
      setPassword('');
      setSuccess('Cuenta agregada correctamente al inventario.');

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo agregar el inventario.',
      );
    } finally {
      setSaving(false);
    }
  }

  const totalStock = offers.reduce(
    (sum, offer) => sum + Number(offer.stock ?? 0),
    0,
  );

  const availableOffers = offers.filter(
    (offer) => Number(offer.stock ?? 0) > 0,
  ).length;

  const outOfStock = offers.filter(
    (offer) => Number(offer.stock ?? 0) === 0,
  ).length;

  const filteredOffers = offers.filter((offer) => {
    const text = [
      offer.products?.name ?? '',
      offer.product_durations?.label ?? '',
    ].join(' ').toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const stock = Number(offer.stock ?? 0);

    const matchesFilter =
      filter === 'todos' ||
      (filter === 'disponibles' && stock > 0) ||
      (filter === 'agotados' && stock === 0);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="inv">
      <header className="inv-header">
        <div>
          <span className="inv-eyebrow">VEXORA · VENDEDOR</span>
          <h1>Mi inventario</h1>
          <p>
            Administra tus cuentas, productos y disponibilidad
            desde un solo lugar.
          </p>
        </div>

        <button
          type="button"
          className="inv-refresh"
          disabled={loading || saving}
          onClick={() => void load()}
        >
          ↻ {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {verified === false && (
        <div className="inv-alert">
          <strong>Verificación pendiente</strong>
          <span>
            Necesitas verificar tu identidad antes de vender.
          </span>
          <Link to="/perfil-proveedor">Ir a Mi perfil →</Link>
        </div>
      )}

      {loadError && (
        <div className="inv-alert">
          <strong>Error al cargar</strong>
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      <section className="inv-stats">
        <div className="inv-stat">
          <span>Ofertas publicadas</span>
          <strong>{loading ? '—' : offers.length}</strong>
          <small>Productos y duraciones registrados</small>
        </div>

        <div className="inv-stat">
          <span>Unidades disponibles</span>
          <strong>{loading ? '—' : totalStock}</strong>
          <small>Stock reportado en inventario</small>
        </div>

        <div className="inv-stat">
          <span>Ofertas con stock</span>
          <strong>{loading ? '—' : availableOffers}</strong>
          <small>Listas para vender</small>
        </div>

        <div className="inv-stat">
          <span>Ofertas agotadas</span>
          <strong>{loading ? '—' : outOfStock}</strong>
          <small>Necesitan reposición</small>
        </div>
      </section>

      <section className="inv-card">
        <div className="inv-section-heading">
          <div>
            <span className="inv-eyebrow">NUEVO INVENTARIO</span>
            <h2>Agregar cuenta</h2>
            <p>
              Selecciona un producto creado por el administrador
              y registra sus perfiles disponibles.
            </p>
          </div>
          <span className="inv-heading-icon">＋</span>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleAdd();
          }}
        >
          <div className="inv-form-grid">
            <div className="inv-field">
              <label htmlFor="inv-product">Producto</label>
              <select
                id="inv-product"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                {products.length === 0 && (
                  <option value="">Sin productos disponibles</option>
                )}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="inv-field">
              <label htmlFor="inv-duration">Duración</label>
              <select
                id="inv-duration"
                value={durationId}
                onChange={(event) => setDurationId(event.target.value)}
                required
              >
                {selectedProduct?.product_durations.map((duration) => (
                  <option key={duration.id} value={duration.id}>
                    {duration.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inv-field">
              <label htmlFor="inv-price">Precio de venta (S/)</label>
              <input
                id="inv-price"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ej. 12.90"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </div>

            <div className="inv-field">
              <label htmlFor="inv-count">Perfiles por cuenta</label>
              <input
                id="inv-count"
                type="number"
                min="1"
                max="10"
                step="1"
                value={profileCount}
                onChange={(event) => setProfileCount(event.target.value)}
                required
              />
            </div>

            <div className="inv-field">
              <label htmlFor="inv-email">Correo de la cuenta</label>
              <input
                id="inv-email"
                type="text"
                placeholder="correo@ejemplo.com"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="inv-field">
              <label htmlFor="inv-password">Contraseña de la cuenta</label>
              <div className="inv-password">
                <input
                  id="inv-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña del producto"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="inv-error">{error}</div>}
          {success && <div className="inv-success">{success}</div>}

          <div className="inv-form-footer">
            <span>
              Los productos son administrados por VEXORA.
            </span>
            <button
              className="inv-submit"
              type="submit"
              disabled={saving || loading || verified !== true || !products.length}
            >
              {saving ? 'Agregando...' : '＋ Agregar cuenta'}
            </button>
          </div>
        </form>
      </section>

      <section className="inv-products">
        <div className="inv-section-heading">
          <div>
            <span className="inv-eyebrow">GESTIÓN DE PRODUCTOS</span>
            <h2>Mis productos</h2>
            <p>Consulta el precio y las unidades disponibles.</p>
          </div>
          <span className="inv-count-badge">
            {offers.length} ofertas
          </span>
        </div>

        <div className="inv-toolbar">
          <input
            type="search"
            aria-label="Buscar producto"
            placeholder="Buscar producto o duración..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filtrar inventario"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as typeof filter)
            }
          >
            <option value="todos">Todos los productos</option>
            <option value="disponibles">Con stock</option>
            <option value="agotados">Agotados</option>
          </select>
        </div>

        {loading ? (
          <div className="inv-empty">Cargando inventario...</div>
        ) : filteredOffers.length === 0 ? (
          <div className="inv-empty">
            {offers.length === 0
              ? 'Aún no tienes inventario. Agrega tu primera cuenta.'
              : 'No encontramos productos con esos filtros.'}
          </div>
        ) : (
          <div className="inv-product-grid">
            {filteredOffers.map((offer) => {
              const stock = Number(offer.stock ?? 0);

              return (
                <article className="inv-product" key={offer.id}>
                  <div className="inv-product-top">
                    <div className="inv-product-icon">▣</div>
                    <span
                      className={`inv-stock-badge ${
                        stock === 0
                          ? 'inv-stock-empty'
                          : stock <= 2
                            ? 'inv-stock-low'
                            : 'inv-stock-ok'
                      }`}
                    >
                      {stock === 0
                        ? 'Agotado'
                        : stock <= 2
                          ? 'Stock bajo'
                          : 'Disponible'}
                    </span>
                  </div>

                  <h3>{offer.products?.name ?? 'Producto'}</h3>
                  <p>{offer.product_durations?.label ?? 'Duración'}</p>

                  <div className="inv-product-bottom">
                    <div>
                      <small>Precio</small>
                      <strong>{money(offer.price)}</strong>
                    </div>
                    <div>
                      <small>Unidades</small>
                      <strong>{stock}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
