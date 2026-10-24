import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PlaySquare, Headphones } from 'lucide-react';
import { usePublishedSermons } from '@/lib/queries';
import { fmtDate } from '@/lib/format';
import { youtubeId } from '@/lib/utils';
import { cld } from '@/lib/cloudinary';
import { SearchInput, Select } from '@/components/ui/input';
import { EmptyState, SkeletonCards } from '@/components/ui/feedback';
import { CwcLogo } from '@/components/brand';
import { MemberPage } from './ui';

export function sermonThumb(s: { thumbnailUrl?: string; videoUrl?: string }) {
  if (s.thumbnailUrl) return cld(s.thumbnailUrl, { w: 640 });
  const y = youtubeId(s.videoUrl);
  return y ? `https://i.ytimg.com/vi/${y}/hqdefault.jpg` : undefined;
}

export default function Sermons() {
  const { data, loading } = usePublishedSermons();
  const [q, setQ] = useState('');
  const [series, setSeries] = useState('');
  const allSeries = useMemo(() => [...new Set(data.map((s) => s.series).filter(Boolean))] as string[], [data]);
  const list = data.filter((s) => (!series || s.series === series) && `${s.title} ${s.preacher} ${s.scripture} ${s.series}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <MemberPage title="Sermons" subtitle="Watch or listen again — audio uses far less data.">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Search sermons" className="flex-1" />
        {allSeries.length > 0 && <Select value={series} onChange={(e) => setSeries(e.target.value)} className="sm:w-48" aria-label="Series"><option value="">All series</option>{allSeries.map((s) => <option key={s}>{s}</option>)}</Select>}
      </div>
      {loading ? <SkeletonCards /> : list.length === 0 ? <div className="card"><EmptyState icon={<PlaySquare />} title="No sermons yet" /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const thumb = sermonThumb(s);
            return (
              <Link key={s.id} to={`/sermons/${s.id}`} className="card group overflow-hidden">
                <div className="relative grid aspect-video place-items-center overflow-hidden bg-brand-900">
                  {thumb ? <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : <CwcLogo className="w-32 text-white/15" />}
                  <span className="relative grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-transform group-hover:scale-110">{s.videoUrl ? <PlaySquare className="size-6" /> : <Headphones className="size-6" />}</span>
                </div>
                <div className="p-3.5">
                  <p className="text-xs text-fg-3">{fmtDate(s.date)}{s.series ? ` · ${s.series}` : ''}</p>
                  <h3 className="mt-0.5 line-clamp-2 font-semibold">{s.title}</h3>
                  <p className="mt-0.5 text-xs text-fg-3">{s.preacher}{s.scripture ? ` · ${s.scripture}` : ''}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </MemberPage>
  );
}
