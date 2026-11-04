import { type ReactNode } from 'react';

export function Modal({
  open,
  onClose,
  children,
  maxWidth = 420,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
}) {
  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: '1rem',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth, maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer' }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
