import { Outlet, Link } from 'react-router';
import { CwcLogo, Signature } from '@/components/brand';
import { useChurch } from '@/lib/settings';

export default function AuthLayout() {
  const church = useChurch();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_10%,rgb(59_99_241/0.45),transparent_60%),radial-gradient(60%_50%_at_90%_90%,rgb(201_154_46/0.25),transparent_60%)]" />
        <CwcLogo className="pointer-events-none absolute -bottom-16 -right-24 w-[620px] text-white/[0.06]" />
        <Link to="/welcome" className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <CwcLogo className="w-8 text-white" weight={20} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">{church.name}</span>
        </Link>
        <div className="relative max-w-md">
          <p className="font-serif text-[2rem] leading-tight tracking-tight text-balance">
            “Let everything that has breath praise the Lord.”
          </p>
          <p className="mt-3 text-sm text-white/70">Psalm 150:6</p>
          <p className="mt-10 text-sm leading-relaxed text-white/75">
            One home for church life — devotionals, events, giving records, prayer and pastoral care, all in your pocket.
          </p>
        </div>
        <div className="relative text-xs text-white/60">{church.tagline}</div>
      </aside>
      <main className="flex min-h-dvh flex-col bg-bg px-5 pt-safe sm:px-8">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <Link to="/welcome" className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-800 text-white">
              <CwcLogo className="w-8" weight={20} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">{church.name}</span>
          </Link>
          <Outlet />
        </div>
        <footer className="mx-auto flex w-full max-w-[400px] items-center justify-between gap-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-xs text-fg-3">
          <span>© {new Date().getFullYear()} {church.shortName}</span>
          <Signature />
        </footer>
      </main>
    </div>
  );
}
