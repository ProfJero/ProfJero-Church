import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Plus, CalendarDays, MapPin, Users } from 'lucide-react';
import { useEvents } from '@/lib/queries';
import { fmtDate, fmtTime, num } from '@/lib/format';
import { cld } from '@/lib/cloudinary';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SkeletonCards } from '@/components/ui/feedback';
import { EventForm } from './EventForm';
import { CwcLogo } from '@/components/brand';

export function EventDateBadge({ date, className = '' }: { date: string; className?: string }) {
  return (
    <span className={`grid w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface py-1.5 text-center leading-none ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">{fmtDate(date, 'MMM')}</span>
      <span className="mt-0.5 text-lg font-semibold">{fmtDate(date, 'd')}</span>
    </span>
  );
}

export default function AdminEvents() {
  const { data, loading } = useEvents();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'upcoming' | 'past' | 'drafts'>('upcoming');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (params.get('new') === '1') {
      setOpen(true);
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const now = new Date().toISOString().slice(0, 16);
  const list = data
    .filter((e) => (view === 'drafts' ? e.status === 'draft' : e.status === 'published' && (view === 'upcoming' ? (e.endAt || e.startAt) >= now : (e.endAt || e.startAt) < now)))
    .sort((a, b) => (view === 'past' ? b.startAt.localeCompare(a.startAt) : a.startAt.localeCompare(b.startAt)));

  return (
    <Page>
      <PageHeader title="Events" description="Services, conferences, outreaches and fellowship." actions={<Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>New event</Button>} />
      <Segmented className="mb-4" value={view} onChange={setView} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'drafts', label: `Drafts (${data.filter((e) => e.status === 'draft').length})` }]} />
      {loading ? (
        <SkeletonCards />
      ) : list.length === 0 ? (
        <div className="card"><EmptyState icon={<CalendarDays />} title={view === 'upcoming' ? 'No upcoming events' : view === 'past' ? 'No past events' : 'No drafts'} action={<Button icon={<Plus />} onClick={() => setOpen(true)}>Create event</Button>} /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <Link key={e.id} to={`/admin/events/${e.id}`} className="card group overflow-hidden transition-colors hover:border-line-strong">
              <div className="relative aspect-[16/8] overflow-hidden bg-[linear-gradient(135deg,var(--color-brand-800),var(--color-brand-600))]">
                {e.imageUrl ? <img src={cld(e.imageUrl, { w: 640 })} alt="" className="size-full object-cover" loading="lazy" /> : <CwcLogo className="absolute -bottom-6 -right-6 w-44 text-white/10" />}
                <EventDateBadge date={e.startAt} className="absolute left-3 top-3 shadow-sm" />
                {e.status === 'draft' && <Badge className="absolute right-3 top-3">Draft</Badge>}
              </div>
              <div className="p-4">
                <div className="text-xs font-medium text-fg-3">{e.category} · {fmtDate(e.startAt, 'EEE')} {fmtTime(e.startAt)}</div>
                <h3 className="mt-1 line-clamp-2 font-semibold group-hover:underline">{e.title}</h3>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-fg-3">
                  <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{e.location || 'TBA'}</span></span>
                  {e.rsvpEnabled && <span className="flex shrink-0 items-center gap-1"><Users className="size-3.5" />{num(e.rsvpCount)}{e.capacity ? `/${e.capacity}` : ''}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <EventForm open={open} onOpenChange={setOpen} onSaved={(id) => navigate(`/admin/events/${id}`)} />
    </Page>
  );
}
