import { Link } from 'react-router';
import { BookOpen, Bookmark } from 'lucide-react';
import { usePublishedDevotionals } from '@/lib/queries';
import { fmtDate, isoDate } from '@/lib/format';
import { excerpt } from '@/lib/utils';
import { useLocalState } from '@/lib/hooks';
import { Segmented } from '@/components/ui/tabs';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { useState } from 'react';
import { MemberPage } from './ui';

export default function Devotionals() {
  const { data, loading } = usePublishedDevotionals(isoDate());
  const [saved] = useLocalState<string[]>('cwc-saved-devotionals', []);
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const list = tab === 'saved' ? data.filter((d) => saved.includes(d.id)) : data;
  return (
    <MemberPage title="Devotionals" subtitle="Daily bread for your spirit.">
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: 'all', label: 'All' }, { value: 'saved', label: `Saved (${saved.length})` }]} />
      {loading ? <div className="card"><SkeletonRows /></div> : list.length === 0 ? (
        <div className="card"><EmptyState icon={tab === 'saved' ? <Bookmark /> : <BookOpen />} title={tab === 'saved' ? 'Nothing saved yet' : 'No devotionals yet'} description={tab === 'saved' ? 'Tap the bookmark on a devotional to keep it here — it works offline too.' : undefined} /></div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((d, i) => (
            <li key={d.id}>
              <Link to={`/devotionals/${d.id}`} className="card flex gap-4 p-4 transition-colors hover:border-line-strong">
                <span className="grid w-12 shrink-0 place-items-center self-start rounded-xl bg-surface-2 py-1.5 text-center leading-none">
                  <span className="text-[10px] font-semibold uppercase text-fg-3">{fmtDate(d.date, 'MMM')}</span>
                  <span className="mt-0.5 text-lg font-semibold">{fmtDate(d.date, 'd')}</span>
                </span>
                <span className="min-w-0">
                  {i === 0 && tab === 'all' && d.date === isoDate() && <span className="mb-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-soft-fg">Today</span>}
                  <span className="block font-semibold">{d.title}</span>
                  <span className="mt-0.5 block text-xs font-medium text-fg-3">{d.scripture}</span>
                  <span className="mt-1.5 line-clamp-2 block font-serif text-sm text-fg-2">{excerpt(d.body, 160)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MemberPage>
  );
}
