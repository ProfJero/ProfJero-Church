import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { HeartHandshake, HandHeart, CalendarDays, PlaySquare, BookOpen, Bell, Pin, ScanLine, ChevronRight, Sparkles, Quote } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { useChurch } from '@/lib/settings';
import { db, useCollection } from '@/lib/db';
import { usePublishedAnnouncements, usePublishedDevotionals, usePublishedEvents, usePublishedSermons, usePublishedTestimonies } from '@/lib/queries';
import { fmtDate, greeting, isoDate, relative } from '@/lib/format';
import { excerpt, youtubeId } from '@/lib/utils';
import { cld } from '@/lib/cloudinary';
import { enablePush, getPushState, needsInstallForPush, type PushState } from '@/lib/push';
import type { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CwcLogo } from '@/components/brand';
import { MemberPage, SectionTitle, Rail, EventCard, QuickAction } from './ui';
import { toast } from 'sonner';

export default function Home() {
  const { profile, user } = useAuth();
  const church = useChurch();
  const today = isoDate();
  const { data: devs, loading: devLoading } = usePublishedDevotionals(today);
  const { data: events } = usePublishedEvents();
  const { data: sermons } = usePublishedSermons();
  const { data: announcements } = usePublishedAnnouncements();
  const { data: testimonies } = usePublishedTestimonies();
  const { data: live } = useCollection<Service>('services:live', () => query(collection(db, 'services'), where('isOpen', '==', true)));
  const [push, setPush] = useState<PushState | null>(null);

  useEffect(() => {
    getPushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  const devotional = devs[0];
  const now = new Date().toISOString().slice(0, 16);
  const upcoming = useMemo(() => events.filter((e) => (e.endAt || e.startAt) >= now).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 6), [events, now]);
  const notices = announcements.filter((a) => !a.expiresOn || a.expiresOn >= today).sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, 5);
  const liveToday = live.filter((s) => s.date === today);
  const sermon = sermons[0];
  const firstName = (profile?.fullName ?? '').split(' ')[0];

  async function turnOnPush() {
    try {
      const s = await enablePush(user!.uid);
      setPush(s);
      if (s === 'subscribed') toast.success('Notifications are on');
      else if (s === 'denied') toast.error('Notifications are blocked in your browser settings');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <MemberPage>
      <header className="mb-5">
        <p className="text-sm text-fg-3">{fmtDate(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="mt-0.5 text-[1.75rem] font-semibold leading-tight tracking-tight">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
      </header>

      {liveToday.map((s) => (
        <Link key={s.id} to={`/checkin/${s.id}`} className="mb-4 flex items-center gap-3 rounded-2xl border border-success/25 bg-success-soft px-4 py-3">
          <span className="grid size-10 place-items-center rounded-xl bg-success text-white dark:text-black"><ScanLine className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-success">{s.title} is on</span><span className="block text-xs text-fg-2">Tap to check yourself in</span></span>
          <ChevronRight className="size-5 text-success" />
        </Link>
      ))}

      {/* Today's devotional */}
      {devLoading ? (
        <div className="skeleton h-56 rounded-3xl" />
      ) : devotional ? (
        <Link to={`/devotionals/${devotional.id}`} className="group relative block overflow-hidden rounded-3xl bg-brand-900 p-5 text-white shadow-[var(--shadow-pop)] sm:p-7">
          {devotional.imageUrl && <img src={cld(devotional.imageUrl, { w: 900 })} alt="" className="absolute inset-0 size-full object-cover opacity-35" />}
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_0%,rgb(59_99_241/0.55),transparent_60%),radial-gradient(70%_60%_at_100%_100%,rgb(201_154_46/0.35),transparent_60%)]" />
          <CwcLogo className="absolute -bottom-10 -right-10 w-64 text-white/[0.07]" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
              <BookOpen className="size-3.5" /> {devotional.date === today ? 'Today’s devotional' : fmtDate(devotional.date, 'EEE d MMM')}
            </span>
            <h2 className="mt-4 font-serif text-[1.65rem] leading-tight text-balance sm:text-3xl">{devotional.title}</h2>
            {devotional.scriptureText && <p className="mt-3 line-clamp-3 font-serif text-[15px] italic leading-relaxed text-white/85">“{devotional.scriptureText}”</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white/80">{devotional.scripture}</span>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition-transform group-active:scale-95">Read</span>
            </div>
          </div>
        </Link>
      ) : (
        <div className="card flex items-center gap-4 p-5">
          <BookOpen className="size-6 text-fg-3" />
          <p className="text-sm text-fg-3">Today’s devotional will appear here.</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-4 gap-2.5 sm:gap-3">
        <QuickAction to="/care/new?type=prayer" icon={<HeartHandshake />} label="Prayer" tone="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" />
        <QuickAction to="/give" icon={<HandHeart />} label="Give" tone="bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300" />
        <QuickAction to="/events" icon={<CalendarDays />} label="Events" tone="bg-accent-soft text-accent-soft-fg" />
        <QuickAction to="/sermons" icon={<PlaySquare />} label="Sermons" tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
      </div>

      {push === 'default' && !needsInstallForPush() && (
        <div className="card mt-5 flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-fg"><Bell className="size-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Stay in the loop</p><p className="text-xs text-fg-3">Get the daily devotional and event reminders.</p></div>
          <Button size="sm" onClick={turnOnPush}>Turn on</Button>
        </div>
      )}

      {notices.length > 0 && (
        <>
          <SectionTitle>Announcements</SectionTitle>
          <div className="space-y-2.5">
            {notices.map((a) => (
              <div key={a.id} className="card overflow-hidden">
                {a.imageUrl && <img src={cld(a.imageUrl, { w: 900 })} alt="" className="aspect-[16/7] w-full object-cover" loading="lazy" />}
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="size-3.5 text-gold-600" />}
                    <h3 className="font-semibold">{a.title}</h3>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg-2">{a.body}</p>
                  <p className="mt-2 text-xs text-fg-3">{relative(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionTitle to="/events">Coming up</SectionTitle>
          <Rail>{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</Rail>
        </>
      )}

      {sermon && (
        <>
          <SectionTitle to="/sermons">Latest sermon</SectionTitle>
          <Link to={`/sermons/${sermon.id}`} className="card flex items-center gap-4 overflow-hidden p-3">
            <div className="relative grid aspect-video w-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-900 sm:w-44">
              {(sermon.thumbnailUrl || youtubeId(sermon.videoUrl)) ? <img src={sermon.thumbnailUrl ? cld(sermon.thumbnailUrl, { w: 360 }) : `https://i.ytimg.com/vi/${youtubeId(sermon.videoUrl)}/mqdefault.jpg`} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : <CwcLogo className="w-20 text-white/20" />}
              <PlaySquare className="relative size-7 text-white drop-shadow" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-fg-3">{fmtDate(sermon.date)} · {sermon.preacher}</p>
              <h3 className="mt-0.5 line-clamp-2 font-semibold">{sermon.title}</h3>
              {sermon.scripture && <p className="mt-0.5 text-xs text-fg-3">{sermon.scripture}</p>}
            </div>
          </Link>
        </>
      )}

      {testimonies.length > 0 && (
        <>
          <SectionTitle to="/care/wall" label="Prayer wall">Testimonies</SectionTitle>
          <Rail className="lg:grid-cols-2">
            {testimonies.slice(0, 4).map((t) => (
              <div key={t.id} className="card w-[78vw] max-w-[340px] shrink-0 snap-start p-4 sm:w-auto sm:max-w-none">
                <Quote className="size-5 text-gold-500" />
                <h3 className="mt-2 font-semibold">{t.title}</h3>
                <p className="mt-1 line-clamp-4 text-sm text-fg-2">{excerpt(t.body, 220)}</p>
                <p className="mt-2 text-xs text-fg-3">— {t.name}</p>
              </div>
            ))}
          </Rail>
        </>
      )}

      <div className="card mt-8 flex items-center gap-4 p-5">
        <Sparkles className="size-6 shrink-0 text-gold-500" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{church.serviceTimes}</p>
          <p className="text-sm text-fg-3">{church.address || church.name}</p>
        </div>
      </div>
    </MemberPage>
  );
}
