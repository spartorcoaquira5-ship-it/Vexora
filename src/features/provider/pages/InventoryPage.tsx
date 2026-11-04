import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { getMyProvider } from '../api/provider';
import { listActiveProductsForProvider, listMyOffers, addInventory, stockForOffer, type MyOffer } from '../api/inventory';
import { money } from '@/shared/lib/format';
import { EmptyState } from '@/shared/components/EmptyState';

interface ProductOpt { id: string; name: string; product_durations: { id: string; label: string }[]; }

export default function InventoryPage() {
  const { profile } = useAuth();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [offers, setOffers] = useState<(MyOffer & { stock?: number })[]>([]);
  const [productId, setProductId] = useState('');
  const [durationId, setDurationId] = useState('');
  const [price, setPrice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileCount, setProfileCount] = useState('6');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!profile) return;
    const prov = await getMyProvider();
    setVerified(prov.verified);
    const prods = await listActiveProductsForProvider();
    setProducts(prods as ProductOpt[]);
    if (!productId && prods[0]) setProductId(prods[0].id);
    const mine = await listMyOffers(profile.id);
    const withStock = await Promise.all(mine.map(async (o) => ({ ...o, stock: await stockForOffer(o.id) })));
    setOffers(withStock);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.id]);

  const selectedProduct = products.find((p) => p.id === productId);
  useEffect(() => {
    if (selectedProduct && !selectedProduct.product_durations.find((d) => d.id === durationId)) {
      setDurationId(selectedProduct.product_durations[0]?.id ?? '');
    }
  }, [selectedProduct, durationId]);

  async function handleAdd() {
    if (!profile) return;
    setError(null);
    const priceNum = parseFloat(price);
    const n = parseInt(profileCount, 10);
    if (!(priceNum > 0) || !(n >= 1 && n <= 10) || !email || !password) {
      return setError('Completa precio, perfiles (1-10), correo y contraseña.');
    }
    setSaving(true);
    try {
      await addInventory({ providerId: profile.id, productId, durationId, price: priceNum, email, password, profileCount: n });
      setEmail(''); setPassword('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el inventario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Mi inventario</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>
        Solo puedes agregar cuentas a productos que el administrador ya creó; tú no creas productos.
      </p>

      {verified === false && (
        <div style={{ background: 'var(--yellow-light)', border: '1px solid var(--yellow)', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13 }}>
          Aún no puedes vender: necesitas verificar tu identidad primero en <strong>Mi perfil</strong>.
        </div>
      )}

      <div className="panel-card">
        <h3>Agregar cuenta al inventario</h3>
        <div className="form-grid">
          <div className="field">
            <label>Producto</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Duración</label>
            <select value={durationId} onChange={(e) => setDurationId(e.target.value)}>
              {selectedProduct?.product_durations.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Tu precio (S/)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label>Perfiles en la cuenta</label>
            <input type="number" min={1} max={10} value={profileCount} onChange={(e) => setProfileCount(e.target.value)} />
          </div>
          <div className="field">
            <label>Correo de la cuenta</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" style={{ maxWidth: 220 }} disabled={saving || verified === false} onClick={handleAdd}>
          {saving ? 'Agregando...' : 'Agregar cuenta'}
        </button>
      </div>

      {offers.length === 0 ? (
        <EmptyState text="Aún no tienes inventario. Agrega tu primera cuenta." />
      ) : (
        offers.map((o) => (
          <div key={o.id} className="panel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{o.products?.name} — {o.product_durations?.label}</strong>
              <span>{money(o.price)} · Disponibles {o.stock}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
