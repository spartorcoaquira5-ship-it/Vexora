export function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '2rem', textAlign: 'center', color: 'var(--text-2)', fontSize: 14 }}>
      {text}
    </div>
  );
}
