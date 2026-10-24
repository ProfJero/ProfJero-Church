import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { usePublishedEvents } from '@/lib/queries';
import { Segmented } from '@/components/ui/tabs';
import { EmptyState, SkeletonCards } from '@/components/ui/feedback';
import { useChurch } from '@/lib/settings';
import { MemberPage, EventCard } from './ui';

export default function Events() {
  const { data, loading } = usePublishedEvents();
  const church = useChurch();
  const [cat, setCat] = useState('all');
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const now = new Date().toISOString().slice(0, 16);
  const cats = useMemo(() => church.eventCategories.filter((c) => data.some((e) => e.category === c)), [church.eventCategories, data]);
  const list = data
    .filter((e) => (when === 'upcoming' ? (e.endAt || e.startAt) >= now : (e.endAt || e.startAt) < now) && (cat === 'all' || e.category === cat))
    .sort((a, b) => (when === 'upcoming' ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)));
  return (
    <MemberPage title="Events" subtitle="Find your place — services, conferences and fellowship.">
      <div className="mb-4 space-y-2">
        <Segmented value={when} onChange={setWhen} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} />
        {cats.length > 1 && (
          <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {['all', ...cats].map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium ${cat === c ? 'border-transparent bg-fg text-bg' : 'border-line-strong text-fg-2'}`}>
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        )}
      </div>
      {loading ? <SkeletonCards /> : list.length === 0 ? (
        <div className="card"><EmptyState icon={<CalendarDays />} title={when === 'upcoming' ? 'Nothing scheduled yet' : 'No past events'} description="Check back soon — new events are announced here and by notification." /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((e) => <EventCard key={e.id} e={e} className="w-auto max-w-none" />)}</div>
      )}
    </MemberPage>
  );
}
