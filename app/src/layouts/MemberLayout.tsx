import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Download, LayoutDashboard, WifiOff, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useChurch } from '@/lib/settings';
import { useInstallPrompt, useOnline } from '@/lib/pwa';
import { useLocalState } from '@/lib/hooks';
import { refreshPushSubscription } from '@/lib/push';
import { cn } from '@/lib/utils';
import { CwcLogo, Signature } from '@/components/brand';
import { NotificationBell } from '@/components/notification-bell';
import { UserMenu } from '@/components/user-menu';
import { ButtonLink, Button } from '@/components/ui/button';
import { MEMBER_EXTRA, MEMBER_NAV } from './nav';

function InstallBanner() {
  const install = useInstallPrompt();
  const [dismissed, setDismissed] = useLocalState('cwc-install-dismissed', 0);
  const recentlyDismissed = Date.now() - dismissed < 1000 * 60 * 60 * 24 * 14;
  if (install.installed || recentlyDismissed || (!install.canInstall && !install.iosHint)) return null;
  return (
    <div className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-2xl border border-brand-200/70 bg-accent-soft px-4 py-3 text-sm dark:border-brand-500/20">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-800 text-white">
        <CwcLogo className="w-6" weight={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-accent-soft-fg">Install the CWC app</p>
        <p className="text-[13px] text-fg-2">
          {install.canInstall ? 'Faster, works offline, and gets notifications.' : 'Tap Share, then “Add to Home Screen”.'}
        </p>
      </div>
      {install.canInstall && (
        <Button size="sm" icon={<Download />} onClick={install.install}>
          Install
        </Button>
      )}
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(Date.now())} className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:bg-surface/60">
        <X className="size-4" />
      </button>
    </div>
  );
}

export default function MemberLayout() {
  const church = useChurch();
  const { staff, user } = useAuth();
  const online = useOnline();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    if (user) void refreshPushSubscription(user.uid);
  }, [user]);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-800 text-white">
              <CwcLogo className="w-6" weight={24} />
            </span>
            <span className="truncate text-[15px] font-semibold tracking-tight">
              <span className="sm:hidden">{church.shortName}</span>
              <span className="hidden sm:inline">{church.name}</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {[...MEMBER_NAV.slice(0, 4), ...MEMBER_EXTRA].map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-surface-2 text-fg' : 'text-fg-3 hover:text-fg')
                }
              >
                {i.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          {staff && (
            <ButtonLink to="/admin" variant="outline" size="sm" icon={<LayoutDashboard />} className="hidden sm:inline-flex">
              Admin
            </ButtonLink>
          )}
          <NotificationBell />
          <UserMenu context="member" />
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-1.5 text-xs font-medium text-warning">
            <WifiOff className="size-3.5" /> Offline — showing saved content.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:pb-12">
        <InstallBanner />
        <Outlet />
        <footer className="mt-14 hidden items-center justify-between border-t border-line pt-6 text-xs text-fg-3 md:flex">
          <span>
            © {new Date().getFullYear()} {church.name}
          </span>
          <Signature />
        </footer>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {MEMBER_NAV.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                cn('relative flex h-15 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors', isActive ? 'text-accent dark:text-brand-300' : 'text-fg-3')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('absolute top-0 h-0.5 w-8 rounded-full bg-current transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                  <i.icon className="size-[21px]" strokeWidth={isActive ? 2.25 : 1.9} />
                  {i.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
