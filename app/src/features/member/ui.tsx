import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, CalendarDays, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cld } from '@/lib/cloudinary';
import { fmtDate, fmtTime, friendlyDay } from '@/lib/format';
import { CwcLogo } from '@/components/brand';
import type { ChurchEvent } from '@/lib/types';
import { useDocumentTitle } from '@/lib/hooks';

export function MemberPage({ title, subtitle, action, children, back }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; back?: { to: string; label: string } }) {
  useDocumentTitle(typeof title === 'string' ? title : '');
  return (
    <div className="animate-fade-in">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-fg-3 hover:text-fg">← {back.label}</Link>
      )}
      {title && (
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.6rem] font-semibold leading-tight tracking-tight text-balance">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-fg-3">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionTitle({ children, to, label = 'See all' }: { children: ReactNode; to?: string; label?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between">
      <h2 className="text-[17px] font-semibold tracking-tight">{children}</h2>
      {to && (
        <Link to={to} className="inline-flex items-center text-[13px] font-medium text-accent dark:text-brand-300">
          {label}
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** Edge-to-edge horizontal scroller on phones; grid on wider screens. */
export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3', className)}>{children}</div>;
}

export function EventCard({ e, className }: { e: ChurchEvent; className?: string }) {
  return (
    <Link to={`/events/${e.id}`} className={cn('card group block w-[78vw] max-w-[340px] shrink-0 snap-start overflow-hidden sm:w-auto sm:max-w-none', className)}>
      <div className="relative aspect-[16/9] overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-800),var(--color-brand-600))]">
        {e.imageUrl ? <img src={cld(e.imageUrl, { w: 640 })} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" /> : <CwcLogo className="absolute -bottom-6 -right-8 w-48 text-white/10" />}
        <span className="absolute left-3 top-3 rounded-lg bg-surface/95 px-2 py-1 text-center leading-none shadow-sm">
          <span className="block text-[10px] font-bold uppercase text-danger">{fmtDate(e.startAt, 'MMM')}</span>
          <span className="block text-base font-semibold text-fg">{fmtDate(e.startAt, 'd')}</span>
        </span>
      </div>
      <div className="p-3.5">
        <h3 className="line-clamp-1 font-semibold">{e.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-3"><CalendarDays className="size-3.5" />{friendlyDay(e.startAt)} · {fmtTime(e.startAt)}</p>
        {e.location && <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-fg-3"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{e.location}</span></p>}
      </div>
    </Link>
  );
}

export function QuickAction({ to, icon, label, tone }: { to: string; icon: ReactNode; label: string; tone: string }) {
  return (
    <Link to={to} className="card flex flex-col items-center gap-2 px-2 py-3.5 text-center transition-transform active:scale-95">
      <span className={cn('grid size-11 place-items-center rounded-2xl [&_svg]:size-5', tone)}>{icon}</span>
      <span className="text-[12px] font-medium leading-tight text-fg-2">{label}</span>
    </Link>
  );
}
