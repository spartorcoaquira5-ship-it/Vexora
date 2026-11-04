import { useEffect, useState } from 'react';
import { listAllProducts, listCategories, createProduct, toggleProductActive } from '../api/admin';
import { StatusPill } from '@/shared/components/StatusPill';

interface ProductRow { id: string; name: string; active: boolean; categories?: { name: string }; product_durations: { label: string }[]; }
interface Category { id: string; name: string; }

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [durs, setDurs] = useState('1 mes:30, 3 meses:90');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [p, c] = await Promise.all([listAllProducts(), listCategories()]);
    setProducts(p as unknown as ProductRow[]);
    setCategories(c as Category[]);
    if (!categoryId && c[0]) setCategoryId(c[0].id);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function handleCreate() {
    setError(null);
    const parsed = durs.split(',').map((t) => {
      const [label, days] = t.split(':').map((s) => s.trim());
      return { label, days: parseInt(days, 10) };
    }).filter((d) => d.label && d.days > 0);
    if (!name || parsed.length === 0) return setError('Indica el nombre y al menos una duración, ej. 1 mes:30');
    try {
      await createProduct(name, categoryId, parsed);
      setName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el producto.');
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Productos</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Creas los productos y sus duraciones. Los proveedores solo cargan cuentas.</p>

      <div className="panel-card">
        <h3>Crear producto</h3>
        <div className="form-grid">
          <div className="field"><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Netflix" /></div>
          <div className="field">
            <label>Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Duraciones (nombre:días)</label><input value={durs} onChange={(e) => setDurs(e.target.value)} /></div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" style={{ maxWidth: 200 }} onClick={handleCreate}>Crear producto</button>
      </div>

      {products.map((p) => (
        <div key={p.id} className="row-item">
          <span>
            <strong>{p.name}</strong> · {p.categories?.name}
            <br />
            <span style={{ color: 'var(--text-2)' }}>{p.product_durations.map((d) => d.label).join(' / ')}</span>
          </span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusPill status={p.active ? 'confirmada' : 'rechazada'} />
            <button className="mini-btn" onClick={() => toggleProductActive(p.id, !p.active).then(load)}>
              {p.active ? 'Desactivar' : 'Activar'}
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
