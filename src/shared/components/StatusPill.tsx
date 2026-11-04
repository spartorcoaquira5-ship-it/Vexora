const COLORS: Record<string, { bg: string; fg: string }> = {
  pendiente: { bg: 'var(--yellow-light)', fg: 'var(--yellow-dark)' },
  confirmada: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
  aprobado: { bg: 'rgba(96,165,250,0.14)', fg: '#60A5FA' },
  pagado: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
  completado: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
  rechazada: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  rechazado: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  cancelada: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  abierto: { bg: 'var(--yellow-light)', fg: 'var(--yellow-dark)' },
  en_revision: { bg: 'rgba(96,165,250,0.14)', fg: '#60A5FA' },
  resuelto: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
  retenido: { bg: 'var(--yellow-light)', fg: 'var(--yellow-dark)' },
  liberado: { bg: 'var(--green-light)', fg: 'var(--green-dark)' },
  reembolsado: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
};

export function StatusPill({ status }: { status: string }) {
  const c = COLORS[status] ?? { bg: 'var(--border)', fg: 'var(--text-2)' };
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999 }}>
      {status.replace('_', ' ')}
    </span>
  );
}
