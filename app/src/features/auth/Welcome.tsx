import { BookOpen, CalendarDays, HandHeart, HeartHandshake, MapPin, Clock, Download, Bell } from 'lucide-react';
import { ButtonLink, Button } from '@/components/ui/button';
import { CwcLogo, Signature } from '@/components/brand';
import { useChurch } from '@/lib/settings';
import { useDocumentTitle } from '@/lib/hooks';
import { useInstallPrompt } from '@/lib/pwa';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  { icon: BookOpen, title: 'Daily devotionals', text: 'Start each day in the Word with a fresh devotional and prayer.' },
  { icon: CalendarDays, title: 'Events & services', text: 'Never miss a service, conference or fellowship — RSVP in one tap.' },
  { icon: HeartHandshake, title: 'Prayer & care', text: 'Send prayer, counselling or visitation requests straight to the pastors.' },
  { icon: HandHeart, title: 'Giving made simple', text: 'MoMo and bank details on hand, plus your personal giving history.' },
];

export default function Welcome() {
  useDocumentTitle('Welcome');
  const church = useChurch();
  const { user } = useAuth();
  const install = useInstallPrompt();

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-800 text-white">
            <CwcLogo className="w-7" weight={22} />
          </span>
          <span className="truncate text-[15px] font-semibold tracking-tight">{church.name}</span>
        </span>
        <ButtonLink to={user ? '/' : '/login'} variant="outline" size="sm">
          {user ? 'Open app' : 'Sign in'}
        </ButtonLink>
      </header>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-12 pt-14 sm:px-8 sm:pt-20 lg:pb-20">
        <CwcLogo className="pointer-events-none absolute -right-20 top-6 hidden w-[560px] text-brand-800/[0.05] md:block dark:text-brand-300/[0.06]" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-2">
            <span className="size-1.5 rounded-full bg-gold-500" />
            {church.tagline}
          </span>
          <h1 className="mt-5 text-[clamp(2.1rem,6vw,3.6rem)] font-semibold leading-[1.05] tracking-tight text-balance">
            Church life, <span className="font-serif font-medium italic text-brand-700 dark:text-brand-300">beautifully</span> connected.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-fg-2 text-pretty">
            The {church.name} app keeps you close to the family — devotionals, events, sermons, giving and pastoral care in one place. Works on any phone, even
            on a slow connection.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to={user ? '/' : '/signup'} size="lg">
              {user ? 'Continue to app' : 'Create your account'}
            </ButtonLink>
            {install.canInstall ? (
              <Button variant="outline" size="lg" icon={<Download />} onClick={install.install}>
                Install the app
              </Button>
            ) : (
              !user && (
                <ButtonLink to="/login" variant="outline" size="lg">
                  I already have an account
                </ButtonLink>
              )
            )}
          </div>
          {install.iosHint && (
            <p className="mt-4 text-sm text-fg-3">
              On iPhone: tap <span className="font-medium text-fg-2">Share</span> → <span className="font-medium text-fg-2">Add to Home Screen</span> to install.
            </p>
          )}
        </div>
      </section>

      <section aria-label="What you can do" className="mx-auto grid max-w-6xl gap-3 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-soft-fg">
              <f.icon className="size-5" />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-3">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-3 max-w-6xl px-5 sm:px-8">
        <div className="card grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
          <Info icon={<Clock />} label="Service times" value={church.serviceTimes} />
          <Info icon={<MapPin />} label="Find us" value={[church.address, church.gpsAddress].filter(Boolean).join(' • ') || 'Ask us for directions'} />
          <Info icon={<Bell />} label="Stay in the loop" value="Turn on notifications in the app for devotionals and event reminders." />
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-10 text-xs text-fg-3 sm:flex-row sm:px-8">
        <span>
          © {new Date().getFullYear()} {church.name}
        </span>
        <Signature />
      </footer>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-fg-3 [&_svg]:size-5">{icon}</span>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-fg-3">{label}</div>
        <div className="mt-1 text-sm text-fg">{value || '—'}</div>
      </div>
    </div>
  );
}
