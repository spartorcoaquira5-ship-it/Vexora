export function money(n: number): string {
  return 'S/ ' + n.toFixed(2);
}

export function formatDate(d: string | number | Date): string {
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(d: string | number | Date): string {
  return new Date(d).toLocaleString('es-PE');
}
