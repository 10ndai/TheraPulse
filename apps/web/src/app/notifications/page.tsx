'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
  readAt: string | null;
  createdAt: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage(): React.JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/notifications?limit=50');
      const body = (await res.json()) as {
        success: boolean;
        data: Notification[];
        error?: { message: string };
      };
      if (body.success) {
        setNotifications(body.data);
      } else {
        setLoadError(body.error?.message ?? 'Failed to load notifications.');
      }
    } catch {
      setLoadError('Failed to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      const body = (await res.json()) as { success: boolean; data: Notification };
      if (body.success) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? body.data : n)));
      }
    } catch {
      // silently ignore mark-read failures
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
      );
    } catch {
      // silently ignore
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading notifications…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="mx-auto max-w-2xl py-16 text-center text-[var(--color-destructive)]"
      >
        {loadError}
      </p>
    );
  }

  const unreadCount = notifications.filter((n) => n.readAt === null).length;
  const hasUnread = unreadCount > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Notifications</h1>
        {hasUnread && (
          <Button type="button" variant="outline" onClick={() => void handleMarkAllRead()}>
            Mark all read
          </Button>
        )}
      </div>

      {hasUnread && <p className="mb-4 text-sm text-[var(--color-muted)]">{unreadCount} unread</p>}

      {notifications.length === 0 ? (
        <p className="text-center text-sm text-[var(--color-muted)]">No notifications yet.</p>
      ) : (
        <ol className="space-y-3">
          {notifications.map((notif) => (
            <li
              key={notif.id}
              className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 ${notif.readAt === null ? 'border-l-4 border-l-[var(--color-primary)]' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--color-foreground)]">{notif.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{notif.body}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {notif.readAt === null && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleMarkRead(notif.id)}
                    aria-label={`Mark notification ${notif.id} as read`}
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
