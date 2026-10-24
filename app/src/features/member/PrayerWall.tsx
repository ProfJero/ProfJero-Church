import { HeartHandshake, Plus, Quote } from 'lucide-react';
import { increment } from 'firebase/firestore';
import { usePrayerWall, usePublishedTestimonies } from '@/lib/queries';
import { patchDoc } from '@/lib/db';
import { relative } from '@/lib/format';
import { useLocalState } from '@/lib/hooks';
import { Button, ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MemberPage } from './ui';

export default function PrayerWall() {
  const { data, loading } = usePrayerWall();
  const { data: testimonies } = usePublishedTestimonies();
  const [prayed, setPrayed] = useLocalState<string[]>('cwc-prayed', []);
  const open = data.filter((c) => c.status !== 'closed');

  async function pray(id: string) {
    if (prayed.includes(id)) return;
    setPrayed((p) => [...p, id]);
    navigator.vibrate?.(12);
    await patchDoc('care_requests', id, { prayedCount: increment(1) }).catch(() => {});
  }

  return (
    <MemberPage title="Prayer wall" subtitle="Carry one another’s burdens. — Galatians 6:2" back={{ to: '/care', label: 'Care' }} action={<ButtonLink to="/care/new?type=prayer" size="sm" icon={<Plus />}>Post</ButtonLink>}>
      <Tabs defaultValue="prayers">
        <TabsList>
          <TabsTrigger value="prayers" count={open.length}>Prayers</TabsTrigger>
          <TabsTrigger value="testimonies" count={testimonies.length}>Testimonies</TabsTrigger>
        </TabsList>
        <TabsContent value="prayers" className="mt-4">
          {loading ? <div className="card"><SkeletonRows /></div> : open.length === 0 ? <div className="card"><EmptyState icon={<HeartHandshake />} title="No public prayer requests" description="When members share a request on the wall, it appears here." /></div> : (
            <div className="space-y-3">
              {open.map((c) => {
                const done = prayed.includes(c.id);
                const name = c.anonymous ? 'Someone in our church' : c.name;
                return (
                  <article key={c.id} className="card p-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.anonymous ? '?' : c.name} size="sm" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{name}</p><p className="text-xs text-fg-3">{relative(c.createdAt)}</p></div>
                    </div>
                    {c.subject && <h3 className="mt-3 font-semibold">{c.subject}</h3>}
                    <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{c.details}</p>
                    {c.responses?.filter((r) => r.by !== c.name).slice(-1).map((r, i) => (
                      <p key={i} className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm"><span className="font-medium">{r.by}:</span> {r.text}</p>
                    ))}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-fg-3">{(c.prayedCount ?? 0) + (done && !c.prayedCount ? 1 : 0)} praying</span>
                      <Button size="sm" variant={done ? 'soft' : 'outline'} icon={<HeartHandshake />} onClick={() => pray(c.id)} disabled={done}>{done ? 'You prayed' : 'I prayed'}</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="testimonies" className="mt-4">
          {testimonies.length === 0 ? <div className="card"><EmptyState icon={<Quote />} title="No testimonies yet" action={<ButtonLink to="/care/new?type=thanksgiving" variant="outline">Share yours</ButtonLink>} /></div> : (
            <div className="space-y-3">
              {testimonies.map((t) => (
                <article key={t.id} className="card p-5">
                  <Quote className="size-5 text-gold-500" />
                  <h3 className="mt-2 font-semibold">{t.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-fg-2">{t.body}</p>
                  <p className="mt-3 text-xs text-fg-3">— {t.name} · {relative(t.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </MemberPage>
  );
}
