import { useParams } from 'react-router';
import { Share2, PlaySquare, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useSermon } from '@/lib/queries';
import { fmtDate } from '@/lib/format';
import { youtubeId } from '@/lib/utils';
import { shareOrCopy } from '@/lib/files';
import { Button, buttonClass } from '@/components/ui/button';
import { EmptyState, FullPageLoader } from '@/components/ui/feedback';
import { MemberPage } from './ui';
import { sermonThumb } from './Sermons';

export default function SermonDetail() {
  const { id } = useParams();
  const { data: s, loading } = useSermon(id);
  if (loading) return <FullPageLoader />;
  if (!s) return <EmptyState icon={<PlaySquare />} title="Sermon not found" />;
  const yt = youtubeId(s.videoUrl);
  return (
    <MemberPage back={{ to: '/sermons', label: 'Sermons' }}>
      <div className="mx-auto max-w-3xl">
        {yt ? (
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe className="size-full" src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`} title={s.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
        ) : sermonThumb(s) ? <img src={sermonThumb(s)} alt="" className="aspect-video w-full rounded-2xl object-cover" /> : null}
        {s.videoUrl && !yt && <a href={s.videoUrl} target="_blank" rel="noreferrer" className={buttonClass('outline', 'sm', 'mt-3')}><ExternalLink /> Watch video</a>}
        <p className="mt-5 text-sm text-fg-3">{fmtDate(s.date, 'EEEE d MMMM yyyy')}{s.series ? ` · ${s.series}` : ''}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{s.title}</h1>
        <p className="mt-1 text-fg-2">{s.preacher}{s.scripture ? ` · ${s.scripture}` : ''}</p>
        {s.audioUrl && (
          <div className="card mt-5 p-4">
            <p className="mb-2 text-sm font-semibold">Listen</p>
            <audio controls preload="none" src={s.audioUrl} className="w-full" />
          </div>
        )}
        {s.summary && <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{s.summary}</p>}
        <Button variant="outline" className="mt-6" icon={<Share2 />} onClick={async () => (await shareOrCopy({ title: s.title, text: `${s.title} — ${s.preacher}`, url: location.href })) === 'copied' && toast.success('Link copied')}>Share</Button>
      </div>
    </MemberPage>
  );
}
