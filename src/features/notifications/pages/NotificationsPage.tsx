import { useEffect, useState } from 'react';
import { listMyNotifications, markRead } from '../api/notifications';
import type { Notification } from '@/shared/types/db';
import { formatDateTime } from '@/shared/lib/format';
import { EmptyState } from '@/shared/components/EmptyState';

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    listMyNotifications().then((list) => {
      setItems(list);
      list.filter((n) => !n.read).forEach((n) => markRead(n.id));
    });
  }, []);

  return (
    <div>
      <h1 style={{ margin: '0 0 16px' }}>Notificaciones</h1>
      {items.length === 0 && <EmptyState text="No tienes notificaciones todavía." />}
      {items.map((n) => (
        <div
          key={n.id}
          style={{
            display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 10px', borderRadius: 8,
            background: n.read ? 'transparent' : 'var(--yellow-light)', marginBottom: 2,
            borderBottom: n.read ? '1px solid var(--border)' : 'none',
          }}
        >
          <strong style={{ fontSize: 13 }}>{n.title}</strong>
          <span style={{ fontSize: 13 }}>{n.message}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatDateTime(n.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
