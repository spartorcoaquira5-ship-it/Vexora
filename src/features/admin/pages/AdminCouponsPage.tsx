import { useEffect, useState } from 'react';
import { listCoupons, createCoupon, sendCouponToClient, listClients } from '../api/admin';
import { money } from '@/shared/lib/format';
import { EmptyState } from '@/shared/components/EmptyState';

interface Coupon { id: string; code: string; type: 'porcentaje' | 'monto_fijo'; value: number; max_uses: number; uses: number; }
interface ClientOpt { id: string; full_name: string; }

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'porcentaje' | 'monto_fijo'>('porcentaje');
  const [value, setValue] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Record<string, string>>({});

  function load() {
    listCoupons().then((c) => setCoupons(c as Coupon[]));
    listClients().then((c) => setClients(c as ClientOpt[]));
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setError(null);
    const v = parseFloat(value);
    const m = parseInt(maxUses, 10);
    if (!code || !(v > 0) || !(m >= 1)) return setError('Completa código, valor y usos máximos.');
    try {
      await createCoupon(code.toUpperCase(), type, v, m);
      setCode(''); setValue('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cupón.');
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 4px' }}>Cupones de descuento</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Crea códigos con un uso máximo. El cliente los aplica al comprar.</p>

      <div className="panel-card">
        <h3>Crear cupón</h3>
        <div className="form-grid">
          <div className="field"><label>Código</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. BIENVENIDA10" /></div>
          <div className="field">
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="porcentaje">% de descuento</option>
              <option value="monto_fijo">Monto fijo (S/)</option>
            </select>
          </div>
          <div className="field"><label>Valor</label><input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="field"><label>Usos máximos</label><input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" style={{ maxWidth: 200 }} onClick={handleCreate}>Crear cupón</button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState text="Aún no creas cupones." />
      ) : (
        coupons.map((c) => (
          <div key={c.id} className="row-item">
            <span><strong>{c.code}</strong> · {c.type === 'porcentaje' ? `${c.value}%` : money(c.value)} · {c.uses}/{c.max_uses} usos</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <select value={selectedClient[c.id] ?? ''} onChange={(e) => setSelectedClient((s) => ({ ...s, [c.id]: e.target.value }))}>
                <option value="">Elegir cliente...</option>
                {clients.map((cl) => <option key={cl.id} value={cl.id}>{cl.full_name}</option>)}
              </select>
              <button
                className="mini-btn"
                disabled={!selectedClient[c.id]}
                onClick={() => sendCouponToClient(c.id, selectedClient[c.id])}
              >
                Enviar
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
