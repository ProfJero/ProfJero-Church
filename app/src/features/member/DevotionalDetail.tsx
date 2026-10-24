import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Bookmark, BookmarkCheck, Share2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useDevotional, usePublishedDevotionals } from '@/lib/queries';
import { fmtDate, isoDate } from '@/lib/format';
import { cld } from '@/lib/cloudinary';
import { shareOrCopy } from '@/lib/files';
import { useLocalState, useDocumentTitle } from '@/lib/hooks';
import { FullPageLoader, EmptyState } from '@/components/ui/feedback';
import { Button, buttonClass } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

export default function DevotionalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = isoDate();
  const { data: list, loading: listLoading } = usePublishedDevotionals(today);
  const realId = id === 'today' ? list[0]?.id : id;
  const { data: d, loading } = useDevotional(realId);
  const [saved, setSaved] = useLocalState<string[]>('cwc-saved-devotionals', []);
  const [size, setSize] = useLocalState<number>('cwc-reader-size', 0);
  useDocumentTitle(d?.title ?? 'Devotional');

  if (id === 'today' && !listLoading && !list.length) return <Navigate to="/devotionals" replace />;
  if (loading || (id === 'today' && listLoading)) return <FullPageLoader />;
  if (!d) return <EmptyState icon={<BookOpen />} title="Devotional not found" action={<Link to="/devotionals" className={buttonClass()}>All devotionals</Link>} />;

  const idx = list.findIndex((x) => x.id === d.id);
  const newer = idx > 0 ? list[idx - 1] : null;
  const older = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const isSaved = saved.includes(d.id);
  const paragraphs = d.body.split(/\n\s*\n/).filter(Boolean);
  const fontSize = ['text-[1.075rem]', 'text-[1.2rem]', 'text-[1.33rem]'][Math.max(0, Math.min(2, size))];

  async function share() {
    const text = `${d!.title} — ${d!.scripture}\n\n“${d!.scriptureText ?? ''}”\n\nRead today’s devotional:`;
    const r = await shareOrCopy({ title: d!.title, text, url: location.href });
    if (r === 'copied') toast.success('Link copied');
  }

  return (
    <article className="mx-auto max-w-2xl animate-fade-in pb-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-3 hover:text-fg"><ChevronLeft className="size-4" />Back</button>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Smaller text" icon={<Minus />} onClick={() => setSize((s) => Math.max(0, s - 1))} />
          <Button size="icon-sm" variant="ghost" aria-label="Larger text" icon={<Plus />} onClick={() => setSize((s) => Math.min(2, s + 1))} />
          <Button size="icon-sm" variant="ghost" aria-label={isSaved ? 'Remove bookmark' : 'Save'} icon={isSaved ? <BookmarkCheck className="text-accent" /> : <Bookmark />} onClick={() => { setSaved((s) => (isSaved ? s.filter((x) => x !== d.id) : [...s, d.id])); toast.success(isSaved ? 'Removed from saved' : 'Saved for offline reading'); }} />
          <Button size="icon-sm" variant="ghost" aria-label="Share" icon={<Share2 />} onClick={share} />
        </div>
      </div>
      <p className="text-sm font-medium text-fg-3">{fmtDate(d.date, 'EEEE, d MMMM yyyy')}</p>
      <h1 className="mt-1 font-serif text-[2rem] font-medium leading-tight tracking-tight text-balance sm:text-[2.4rem]">{d.title}</h1>
      {d.author && <p className="mt-2 text-sm text-fg-3">by {d.author}</p>}
      {d.imageUrl && <img src={cld(d.imageUrl, { w: 1200 })} alt="" className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover" />}
      <blockquote className="mt-6 rounded-2xl border-l-4 border-gold-500 bg-gold-50 px-5 py-4 dark:bg-gold-500/10">
        {d.scriptureText && <p className="font-serif text-lg italic leading-relaxed">“{d.scriptureText}”</p>}
        <footer className="mt-2 text-sm font-semibold text-gold-700 dark:text-gold-300">{d.scripture}</footer>
      </blockquote>
      <div className={`prose-devotion mt-7 ${fontSize}`}>{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
      {d.prayer && (
        <section className="mt-8 rounded-2xl bg-accent-soft p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-accent-soft-fg">Prayer</h2>
          <p className="mt-2 font-serif text-[1.05rem] leading-relaxed">{d.prayer}</p>
        </section>
      )}
      {d.confession && (
        <section className="mt-4 rounded-2xl border border-line p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-fg-3">Confession</h2>
          <p className="mt-2 font-serif text-[1.05rem] font-medium leading-relaxed">{d.confession}</p>
        </section>
      )}
      <nav className="mt-10 grid grid-cols-2 gap-3">
        {older ? <Link to={`/devotionals/${older.id}`} className="card p-4"><span className="flex items-center gap-1 text-xs text-fg-3"><ChevronLeft className="size-3.5" />Previous</span><span className="mt-1 line-clamp-1 block text-sm font-medium">{older.title}</span></Link> : <span />}
        {newer ? <Link to={`/devotionals/${newer.id}`} className="card p-4 text-right"><span className="flex items-center justify-end gap-1 text-xs text-fg-3">Next<ChevronRight className="size-3.5" /></span><span className="mt-1 line-clamp-1 block text-sm font-medium">{newer.title}</span></Link> : <span />}
      </nav>
    </article>
  );
}
