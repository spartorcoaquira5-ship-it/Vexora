export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 style={{ margin: '0 0 8px' }}>{title}</h1>
      <p style={{ color: 'var(--text-2)' }}>Este módulo todavía no está construido — vamos por partes.</p>
    </div>
  );
}
