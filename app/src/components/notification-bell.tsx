import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import * as Popover from '@radix-ui/react-popover';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useNotificationsFeed } from '@/lib/queries';
import { relative, toDate } from '@/lib/format';
import { useLocalState } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { EmptyState } from './ui/feedback';

export function useUnreadNotifications() {
  const { user } = useAuth();
  const { data } = useNotificationsFeed(user?.uid);
  const [seenAt, setSeenAt] = useLocalState<number>(`cwc-notif-seen-${user?.uid ?? 'anon'}`, 0);
  const unread = useMemo(() => data.filter((n) => (toDate(n.createdAt)?.getTime() ?? 0) > seenAt).length, [data, seenAt]);
  return { items: data, unread, markSeen: () => setSeenAt(Date.now()), seenAt };
}

export function NotificationBell({ className }: { className?: string }) {
  const { items, unread, markSeen, seenAt } = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const [snapshotSeen, setSnapshotSeen] = useState(seenAt);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => e.data?.type === 'PUSH_RECEIVED' && navigator.vibrate?.(30);
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if ('setAppBadge' in navigator) {
      const nav = navigator as Navigator & { setAppBadge: (n: number) => Promise<void>; clearAppBadge: () => Promise<void> };
      (unread ? nav.setAppBadge(unread) : nav.clearAppBadge()).catch(() => {});
    }
  }, [unread]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSnapshotSeen(seenAt);
          markSeen();
        }
      }}
    >
      <Popover.Trigger
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className={cn('relative grid size-10 place-items-center rounded-xl text-fg-2 hover:bg-surface-2 hover:text-fg', className)}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-surface">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-accent hover:underline dark:text-brand-300">
              See all
            </Link>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
            {items.length === 0 ? (
              <EmptyState compact icon={<BellOff />} title="You’re all caught up" description="Church updates will appear here." />
            ) : (
              <ul className="divide-y divide-line">
                {items.slice(0, 12).map((n) => {
                  const isNew = (toDate(n.createdAt)?.getTime() ?? 0) > snapshotSeen;
                  return (
                    <li key={n.id}>
                      <Link to={n.url || '/notifications'} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', isNew ? 'bg-brand-500' : 'bg-transparent')} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{n.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[13px] text-fg-3">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-fg-3">{relative(n.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
