import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, BellOff, BookOpen, CalendarDays, HeartHandshake, Megaphone, PlaySquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import { enablePush, getPushState, needsInstallForPush, type PushState } from '@/lib/push';
import { Button } from '@/components/ui/button';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { useUnreadNotifications } from '@/components/notification-bell';
import { MemberPage } from './ui';

const ICON = { devotional: BookOpen, event: CalendarDays, care: HeartHandshake, sermon: PlaySquare, announcement: Megaphone, general: Bell };

export default function Notifications() {
  const { user } = useAuth();
  const { items, markSeen, seenAt } = useUnreadNotifications();
  const [push, setPush] = useState<PushState | null>(null);
  const [cutoff] = useState(seenAt);
  useEffect(() => {
    markSeen();
    getPushState().then(setPush).catch(() => {});
  }, []);

  return (
    <MemberPage title="Notifications">
      {push && push !== 'subscribed' && push !== 'unsupported' && (
        <Banner tone={push === 'denied' ? 'warning' : 'brand'} icon={push === 'denied' ? <BellOff /> : <Bell />} className="mb-4"
          action={push !== 'denied' && !needsInstallForPush() && <Button size="sm" onClick={async () => { try { setPush(await enablePush(user!.uid)); } catch (e) { toast.error((e as Error).message); } }}>Turn on</Button>}>
          {push === 'denied' ? 'Notifications are blocked. Enable them for this site in your browser settings.' : needsInstallForPush() ? 'On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then turn notifications on.' : 'Turn on notifications to get devotionals, reminders and replies instantly.'}
        </Banner>
      )}
      <div className="card">
        {items.length === 0 ? <EmptyState icon={<Bell />} title="No notifications yet" description="Church updates and replies to your requests show up here." /> : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const Icon = ICON[n.kind] ?? Bell;
              const isNew = (n.createdAt?.toMillis?.() ?? 0) > cutoff;
              return (
                <li key={n.id}>
                  <Link to={n.url || '/'} className="flex gap-3 px-4 py-3.5 hover:bg-surface-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-fg-2"><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2"><span className={isNew ? 'font-semibold' : 'font-medium'}>{n.title}</span>{isNew && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />}</span>
                      <span className="mt-0.5 block text-sm text-fg-2">{n.body}</span>
                      <span className="mt-1 block text-xs text-fg-3">{relative(n.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </MemberPage>
  );
}
