import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Menu as MenuIcon, Search, MoreHorizontal, Smartphone, WifiOff, X } from 'lucide-react';
import * as D from '@radix-ui/react-dialog';
import { useAuth } from '@/lib/auth';
import { useChurch } from '@/lib/settings';
import { useOnline } from '@/lib/pwa';
import { refreshPushSubscription } from '@/lib/push';
import { useCareRequests } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { BrandLockup, Signature } from '@/components/brand';
import { UserMenu } from '@/components/user-menu';
import { NotificationBell } from '@/components/notification-bell';
import { CommandPalette, showCommandPalette } from '@/components/command-palette';
import { ADMIN_NAV, visible, type NavItem } from './nav';

function useBadges() {
  const { can } = useAuth();
  const { data: care } = useCareRequests(can('care.view'));
  return { '/admin/care': care.filter((c) => c.status === 'new').length } as Record<string, number>;
}

function NavItemLink({ item, badge, onNavigate }: { item: NavItem; badge?: number; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
          isActive ? 'bg-surface text-fg shadow-[0_1px_2px_rgb(16_24_40/0.08)] ring-1 ring-line dark:bg-surface-3 dark:ring-0' : 'text-fg-2 hover:bg-surface-3/60 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn('size-[17px] shrink-0', isActive ? 'text-accent dark:text-brand-300' : 'text-fg-3 group-hover:text-fg-2')} />
          <span className="flex-1 truncate">{item.label}</span>
          {!!badge && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-fg tabular">{badge}</span>}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  const church = useChurch();
  const badges = useBadges();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <BrandLockup name={church.name} sub="Church admin" />
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            showCommandPalette();
          }}
          className="flex h-9 w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="hidden rounded border border-line px-1 text-[10px] font-medium lg:block">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2" aria-label="Admin">
        {ADMIN_NAV.map((section) => {
          const items = section.items.filter((i) => visible(i, can));
          if (!items.length) return null;
          return (
            <div key={section.label || 'main'}>
              {section.label && <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">{section.label}</div>}
              <div className="space-y-0.5">
                {items.map((i) => (
                  <NavItemLink key={i.to} item={i} badge={badges[i.to]} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          );
        })}
        <div>
          <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3">Member app</div>
          <NavItemLink item={{ to: '/', label: 'Open member app', icon: Smartphone, end: true }} onNavigate={onNavigate} />
        </div>
      </nav>
      <div className="border-t border-line p-2">
        <UserMenu variant="full" context="admin" />
        <div className="px-2 pb-1 pt-2">
          <Signature />
        </div>
      </div>
    </div>
  );
}

/** Phone bottom bar: the four most-used destinations this role can open, plus More. */
function BottomBar({ onMore }: { onMore: () => void }) {
  const { can } = useAuth();
  const preferred = ['/admin', '/admin/people', '/admin/attendance', '/admin/giving', '/admin/messages', '/admin/care', '/admin/events', '/admin/follow-ups'];
  const all = ADMIN_NAV.flatMap((s) => s.items).filter((i) => visible(i, can));
  const items = preferred.map((p) => all.find((i) => i.to === p)).filter(Boolean).slice(0, 4) as NavItem[];
  const short: Record<string, string> = { '/admin': 'Home', '/admin/people': 'People', '/admin/giving': 'Giving', '/admin/attendance': 'Attendance', '/admin/follow-ups': 'Follow-ups', '/admin/care': 'Care', '/admin/messages': 'Messages', '/admin/events': 'Events' };
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) => cn('flex h-15 flex-col items-center justify-center gap-1 text-[10.5px] font-medium', isActive ? 'text-accent dark:text-brand-300' : 'text-fg-3')}
          >
            <i.icon className="size-[21px]" />
            {short[i.to] ?? i.label}
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className="flex h-15 flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-fg-3">
          <MoreHorizontal className="size-[21px]" />
          More
        </button>
      </div>
    </nav>
  );
}

export default function AdminLayout() {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const online = useOnline();
  const { user } = useAuth();

  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);
  useEffect(() => {
    if (user) void refreshPushSubscription(user.uid);
  }, [user]);

  return (
    <div className="min-h-dvh bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface-2/60 lg:block dark:bg-surface/60">
        <SidebarContent />
      </aside>

      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in lg:hidden" />
          <D.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[min(300px,86vw)] border-r border-line bg-surface-2 pt-safe shadow-[var(--shadow-pop)] data-[state=open]:animate-[slide-in_200ms_ease-out] lg:hidden dark:bg-surface"
          >
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Close className="absolute right-3 top-[max(1rem,env(safe-area-inset-top))] grid size-9 place-items-center rounded-lg text-fg-3 hover:bg-surface-3" aria-label="Close menu">
              <X className="size-4" />
            </D.Close>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 pt-safe backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5 lg:px-8">
            <button type="button" onClick={() => setDrawer(true)} className="grid size-10 place-items-center rounded-xl text-fg-2 hover:bg-surface-2 lg:hidden" aria-label="Open menu">
              <MenuIcon className="size-5" />
            </button>
            <div className="min-w-0 flex-1 lg:hidden">
              <BrandLockup name="CWC Admin" className="[&>span:first-child]:size-8 [&>span:first-child>svg]:w-6" />
            </div>
            <div className="hidden flex-1 lg:block" />
            <button type="button" onClick={showCommandPalette} className="grid size-10 place-items-center rounded-xl text-fg-2 hover:bg-surface-2 lg:hidden" aria-label="Search">
              <Search className="size-[18px]" />
            </button>
            <NotificationBell />
            <div className="lg:hidden">
              <UserMenu context="admin" />
            </div>
          </div>
          {!online && (
            <div className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-1.5 text-xs font-medium text-warning">
              <WifiOff className="size-3.5" /> You’re offline — changes are saved on this device and sync when you reconnect.
            </div>
          )}
        </header>
        <main id="main">
          <Outlet />
        </main>
      </div>
      <BottomBar onMore={() => setDrawer(true)} />
      <CommandPalette />
    </div>
  );
}
