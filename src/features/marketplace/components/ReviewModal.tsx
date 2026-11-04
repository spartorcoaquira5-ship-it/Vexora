import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { submitReview } from '../api/reviews';

export function ReviewModal({ orderId, onClose, onSubmitted }: { orderId: string | null; onClose: () => void; onSubmitted: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!orderId) return;
    if (!comment.trim()) return setError('Cuéntanos brevemente tu experiencia.');
    setSaving(true);
    setError(null);
    try {
      await submitReview(orderId, rating, comment.trim());
      setComment('');
      setRating(5);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la reseña.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!orderId} onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Deja tu reseña</h2>
      <div className="field">
        <label>Calificación</label>
        <div style={{ fontSize: 26, letterSpacing: 4, cursor: 'pointer' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} onClick={() => setRating(n)} style={{ color: n <= rating ? 'var(--yellow-dark)' : 'var(--border)' }}>★</span>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Comentario</label>
        <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="¿Cómo te fue con este proveedor?" />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary" disabled={saving} onClick={handleSubmit}>
        {saving ? 'Enviando...' : 'Enviar reseña'}
      </button>
    </Modal>
  );
}
