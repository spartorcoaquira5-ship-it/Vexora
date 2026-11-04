
import { useCallback, useEffect, useState } from 'react';
import {
  listMyNotifications,
  markRead,
} from '../api/notifications';
import type { Notification } from '@/shared/types/db';
import { formatDateTime } from '@/shared/lib/format';
import { EmptyState } from '@/shared/components/EmptyState';
import './NotificationsPage.css';

type Filter = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [updating, setUpdating] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const list = await listMyNotifications();
      setItems(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las notificaciones.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkRead(id: string) {
    if (updating.includes(id)) return;

    setUpdating((prev) => [...prev, id]);
    setError(null);

    try {
      await markRead(id);

      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo marcar como leída.'
      );
    } finally {
      setUpdating((prev) =>
        prev.filter((item) => item !== id)
      );
    }
  }

  async function handleMarkAllRead() {
    const unread = items.filter((n) => !n.read);

    if (unread.length === 0) return;

    setError(null);

    for (const n of unread) {
      try {
        await markRead(n.id);

        setItems((prev) =>
          prev.map((item) =>
            item.id === n.id
              ? { ...item, read: true }
              : item
          )
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron marcar todas las notificaciones.'
        );
        break;
      }
    }
  }

  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.length - unreadCount;

  const filteredItems = items.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  function notificationKind(title: string) {
    const value = title.toLowerCase();

    if (
      value.includes('confirmada') ||
      value.includes('aprobada') ||
      value.includes('completada')
    ) {
      return 'success';
    }

    if (
      value.includes('rechazada') ||
      value.includes('cancelada')
    ) {
      return 'danger';
    }

    return 'info';
  }

  return (
    <div className="vexora-notifications">
      <div className="vn-header">
        <div>
          <span className="vn-eyebrow">
            MI CUENTA / ACTIVIDAD
          </span>
          <h1>Notificaciones</h1>
          <p>
            Mantente al día con tus compras, recargas
            y movimientos en VEXORA.
          </p>
        </div>

        <div className="vn-header-icon">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
        </div>
      </div>

      <div className="vn-stats">
        <div className="vn-stat">
          <span>Total de notificaciones</span>
          <strong>{items.length}</strong>
          <small>Actividad registrada</small>
        </div>

        <div className="vn-stat">
          <span>Sin leer</span>
          <strong className="vn-yellow">
            {unreadCount}
          </strong>
          <small>Pendientes de revisar</small>
        </div>

        <div className="vn-stat">
          <span>Leídas</span>
          <strong className="vn-green">
            {readCount}
          </strong>
          <small>Notificaciones revisadas</small>
        </div>
      </div>

      <div className="vn-toolbar">
        <div className="vn-filters">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            Todas
          </button>

          <button
            type="button"
            className={filter === 'unread' ? 'active' : ''}
            onClick={() => setFilter('unread')}
          >
            Sin leer ({unreadCount})
          </button>

          <button
            type="button"
            className={filter === 'read' ? 'active' : ''}
            onClick={() => setFilter('read')}
          >
            Leídas
          </button>
        </div>

        <div className="vn-toolbar-actions">
          <button
            type="button"
            className="vn-outline-button"
            onClick={() => void load()}
            disabled={loading}
          >
            ↻ Actualizar
          </button>

          <button
            type="button"
            className="vn-mark-all"
            onClick={() => void handleMarkAllRead()}
            disabled={unreadCount === 0}
          >
            ✓ Marcar todas como leídas
          </button>
        </div>
      </div>

      {error && (
        <div className="vn-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="vn-loading">
          Cargando notificaciones...
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState text="No tienes notificaciones todavía." />
      )}

      {!loading &&
        items.length > 0 &&
        filteredItems.length === 0 && (
          <div className="vn-empty-filter">
            No hay notificaciones en esta categoría.
          </div>
        )}

      {!loading && (
        <div className="vn-list">
          {filteredItems.map((n) => {
            const kind = notificationKind(n.title);

            return (
              <article
                key={n.id}
                className={`vn-item ${n.read ? 'read' : 'unread'}`}
              >
                <div className={`vn-item-icon ${kind}`}>
                  {kind === 'success'
                    ? '✓'
                    : kind === 'danger'
                      ? '!'
                      : 'i'}
                </div>

                <div className="vn-item-content">
                  <div className="vn-item-heading">
                    <strong>{n.title}</strong>
                    {!n.read && (
                      <span className="vn-unread-dot" />
                    )}
                  </div>

                  <p>{n.message}</p>

                  <span className="vn-date">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>

                {!n.read && (
                  <button
                    type="button"
                    className="vn-read-button"
                    onClick={() =>
                      void handleMarkRead(n.id)
                    }
                    disabled={updating.includes(n.id)}
                  >
                    {updating.includes(n.id)
                      ? 'Guardando...'
                      : 'Marcar leída'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
