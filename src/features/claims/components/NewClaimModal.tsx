import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { createClaim } from '../api/claims';

const REASONS = [
  { value: 'no_funciona', label: 'Producto no funciona' },
  { value: 'diferente', label: 'Producto diferente' },
  { value: 'no_recibido', label: 'Producto no recibido' },
  { value: 'otro', label: 'Otro' },
];

export function NewClaimModal({ orderId, onClose, onCreated }: { orderId: string | null; onClose: () => void; onCreated: () => void }) {
  const [reason, setReason] = useState('no_funciona');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!orderId) return;
    if (!description.trim()) return setError('Cuéntanos qué pasó.');
    setSaving(true);
    setError(null);
    try {
      await createClaim(orderId, reason, description.trim());
      setDescription('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el reclamo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!orderId} onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Abrir reclamo</h2>
      <div className="field">
        <label>Motivo</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Cuéntanos qué pasó</label>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={saving} onClick={handleSubmit}>
        {saving ? 'Enviando...' : 'Enviar reclamo'}
      </button>
    </Modal>
  );
}
