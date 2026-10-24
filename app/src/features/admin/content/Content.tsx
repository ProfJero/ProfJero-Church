import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, BookOpen, PlaySquare, Megaphone, Pin, Trash2, Music } from 'lucide-react';
import { toast } from 'sonner';
import { useAnnouncements, useDevotionals, useSermons } from '@/lib/queries';
import { createDoc, patchDoc, removeDoc } from '@/lib/db';
import { excerpt, youtubeId } from '@/lib/utils';
import { fmtDate, isoDate, relative } from '@/lib/format';
import { cld, uploadToCloudinary, cloudinaryConfigured } from '@/lib/cloudinary';
import type { Announcement, ContentStatus, Devotional, Sermon } from '@/lib/types';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Switch, Textarea, TextField } from '@/components/ui/input';
import { ImageUpload } from '@/components/image-upload';
import { useConfirm } from '@/components/ui/confirm';
import { broadcast } from '../messages/PushPanel';

export default function Content() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'devotionals';
  return (
    <Page>
      <PageHeader title="Content" description="Devotionals, sermons and announcements for the member app." />
      <Tabs value={tab} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="devotionals">Devotionals</TabsTrigger>
          <TabsTrigger value="sermons">Sermons</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>
        <TabsContent value="devotionals" className="mt-5"><Devotionals /></TabsContent>
        <TabsContent value="sermons" className="mt-5"><Sermons /></TabsContent>
        <TabsContent value="announcements" className="mt-5"><Announcements /></TabsContent>
      </Tabs>
    </Page>
  );
}

function StatusBadge({ status, date }: { status: ContentStatus; date?: string }) {
  if (status === 'draft') return <Badge>Draft</Badge>;
  if (date && date > isoDate()) return <Badge tone="info">Scheduled</Badge>;
  return <Badge tone="success">Live</Badge>;
}

function Row({ title, meta, body, image, badge, onClick }: { title: string; meta: string; body?: string; image?: string; badge: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-2 sm:px-5">
        {image ? <img src={cld(image, { w: 160, h: 112, fill: true })} alt="" className="hidden h-14 w-20 shrink-0 rounded-lg object-cover sm:block" loading="lazy" /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-fg-3">{meta}</span>
          {body && <span className="mt-0.5 hidden truncate text-[13px] text-fg-2 sm:block">{body}</span>}
        </span>
        {badge}
      </button>
    </li>
  );
}

/* ---------------- Devotionals ---------------- */
const blankDev = () => ({ title: '', date: isoDate(), scripture: '', scriptureText: '', body: '', prayer: '', confession: '', author: '', imageUrl: '', status: 'published' as ContentStatus });

function Devotionals() {
  const { data, loading } = useDevotionals();
  const [edit, setEdit] = useState<Devotional | 'new' | null>(null);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      setEdit('new');
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);
  const today = isoDate();
  const hasToday = data.some((d) => d.date === today && d.status === 'published');
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-3">{hasToday ? 'Today’s devotional is live.' : 'No devotional is published for today yet.'} Schedule ahead by choosing a future date.</p>
        <Button size="sm" icon={<Plus />} onClick={() => setEdit('new')}>New devotional</Button>
      </div>
      <Card>
        {loading ? <SkeletonRows /> : data.length === 0 ? <EmptyState icon={<BookOpen />} title="No devotionals yet" action={<Button icon={<Plus />} onClick={() => setEdit('new')}>Write the first one</Button>} /> : (
          <ul className="divide-y divide-line">
            {data.map((d) => <Row key={d.id} title={d.title} meta={`${fmtDate(d.date, 'EEE d MMM yyyy')} · ${d.scripture}${d.author ? ` · ${d.author}` : ''}`} body={excerpt(d.body, 120)} image={d.imageUrl} badge={<StatusBadge status={d.status} date={d.date} />} onClick={() => setEdit(d)} />)}
          </ul>
        )}
      </Card>
      <DevotionalForm value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function DevotionalForm({ value, onClose }: { value: Devotional | 'new' | null; onClose: () => void }) {
  const confirm = useConfirm();
  const existing = value && value !== 'new' ? value : null;
  const [f, setF] = useState(blankDev);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (value === 'new') setF(blankDev());
    else if (existing) setF({ ...blankDev(), ...existing });
    setNotify(true);
  }, [value, existing]);
  const bind = (k: keyof ReturnType<typeof blankDev>) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });
  const willNotify = f.status === 'published' && f.date === isoDate() && (!existing || existing.status === 'draft' || existing.date !== f.date);

  async function save() {
    if (!f.title.trim() || !f.body.trim() || !f.scripture.trim()) return toast.error('Title, scripture and message are required');
    setBusy(true);
    try {
      const { ...data } = f;
      let id = existing?.id;
      if (existing) await patchDoc('devotionals', existing.id, data, { audit: `Updated devotional ${f.title}` });
      else id = await createDoc('devotionals', data, { audit: `Created devotional ${f.title}` });
      if (willNotify && notify && id) void broadcast({ title: `📖 ${f.title}`, body: `${f.scripture} — start your day in the Word.`, url: `/devotionals/${id}`, kind: 'devotional', image: f.imageUrl || undefined });
      toast.success(f.status === 'draft' ? 'Draft saved' : f.date > isoDate() ? `Scheduled for ${fmtDate(f.date)}` : 'Published');
      onClose();
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (existing && (await confirm({ title: 'Delete this devotional?', danger: true, confirmLabel: 'Delete' }))) {
      await removeDoc('devotionals', existing.id, { audit: `Deleted devotional ${existing.title}` });
      onClose();
    }
  }
  return (
    <Modal open={!!value} onOpenChange={(o) => !o && onClose()} title={existing ? 'Edit devotional' : 'New devotional'} size="lg" footer={<>{existing && <Button variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 />} onClick={del}>Delete</Button>}<Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>{f.status === 'draft' ? 'Save draft' : 'Publish'}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <TextField label="Title" {...bind('title')} />
          <TextField label="Date" type="date" {...bind('date')} hint={f.date > isoDate() ? 'Appears on this date' : undefined} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Scripture reference" placeholder="e.g. Psalm 23:1-3" {...bind('scripture')} />
          <TextField label="Author" placeholder="e.g. Rev. Daniel Asante" {...bind('author')} />
        </div>
        <Field label="Scripture text"><Textarea rows={2} {...bind('scriptureText')} className="font-serif" /></Field>
        <Field label="Message" hint="Separate paragraphs with a blank line."><Textarea rows={9} {...bind('body')} className="font-serif text-[15px] leading-relaxed" /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prayer"><Textarea rows={3} {...bind('prayer')} /></Field>
          <Field label="Confession / declaration"><Textarea rows={3} {...bind('confession')} /></Field>
        </div>
        <Field label="Image (optional)"><ImageUpload value={f.imageUrl} onChange={(v) => setF((s) => ({ ...s, imageUrl: v }))} folder="devotionals" /></Field>
        <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <Switch checked={f.status === 'published'} onCheckedChange={(v) => setF((s) => ({ ...s, status: v ? 'published' : 'draft' }))} label="Published" />
          {willNotify && <Switch checked={notify} onCheckedChange={setNotify} label="Notify members now" />}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Sermons ---------------- */
const blankSermon = () => ({ title: '', preacher: '', date: isoDate(), series: '', scripture: '', summary: '', videoUrl: '', audioUrl: '', thumbnailUrl: '', status: 'published' as ContentStatus });

function Sermons() {
  const { data, loading } = useSermons();
  const [edit, setEdit] = useState<Sermon | 'new' | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button size="sm" icon={<Plus />} onClick={() => setEdit('new')}>New sermon</Button></div>
      <Card>
        {loading ? <SkeletonRows /> : data.length === 0 ? <EmptyState icon={<PlaySquare />} title="No sermons yet" description="Add YouTube links or upload audio so members can catch up." /> : (
          <ul className="divide-y divide-line">
            {data.map((s) => {
              const yt = youtubeId(s.videoUrl);
              return <Row key={s.id} title={s.title} meta={`${fmtDate(s.date)} · ${s.preacher}${s.series ? ` · ${s.series}` : ''}`} body={s.scripture} image={s.thumbnailUrl || (yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : undefined)} badge={<span className="flex items-center gap-2">{s.audioUrl && <Music className="size-4 text-fg-3" />}<StatusBadge status={s.status} /></span>} onClick={() => setEdit(s)} />;
            })}
          </ul>
        )}
      </Card>
      <SermonForm value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function SermonForm({ value, onClose }: { value: Sermon | 'new' | null; onClose: () => void }) {
  const confirm = useConfirm();
  const existing = value && value !== 'new' ? value : null;
  const [f, setF] = useState(blankSermon);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    if (value === 'new') setF(blankSermon());
    else if (existing) setF({ ...blankSermon(), ...existing });
  }, [value, existing]);
  const bind = (k: keyof ReturnType<typeof blankSermon>) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });

  async function uploadAudio(file?: File) {
    if (!file) return;
    setUploading(0);
    try {
      const url = await uploadToCloudinary(file, 'sermons', setUploading);
      setF((s) => ({ ...s, audioUrl: url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  }
  async function save() {
    if (!f.title.trim() || !f.preacher.trim()) return toast.error('Title and preacher are required');
    if (f.videoUrl && !youtubeId(f.videoUrl) && !/^https?:\/\//.test(f.videoUrl)) return toast.error('Enter a valid video link');
    setBusy(true);
    try {
      let id = existing?.id;
      if (existing) await patchDoc('sermons', existing.id, f, { audit: `Updated sermon ${f.title}` });
      else id = await createDoc('sermons', f, { audit: `Added sermon ${f.title}` });
      if (!existing && f.status === 'published' && notify && id) void broadcast({ title: `🎙️ New sermon: ${f.title}`, body: `${f.preacher}${f.scripture ? ` · ${f.scripture}` : ''}`, url: `/sermons/${id}`, kind: 'sermon' });
      toast.success('Saved');
      onClose();
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (existing && (await confirm({ title: 'Delete this sermon?', danger: true, confirmLabel: 'Delete' }))) {
      await removeDoc('sermons', existing.id, { audit: `Deleted sermon ${existing.title}` });
      onClose();
    }
  }
  return (
    <Modal open={!!value} onOpenChange={(o) => !o && onClose()} title={existing ? 'Edit sermon' : 'New sermon'} size="lg" footer={<>{existing && <Button variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 />} onClick={del}>Delete</Button>}<Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <TextField label="Title" {...bind('title')} />
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Preacher" {...bind('preacher')} />
          <TextField label="Date" type="date" {...bind('date')} />
          <TextField label="Series" {...bind('series')} />
        </div>
        <TextField label="Scripture" {...bind('scripture')} />
        <TextField label="YouTube / Facebook video link" placeholder="https://youtu.be/…" {...bind('videoUrl')} />
        <Field label="Audio" hint="Upload MP3 (stored on Cloudinary) — lighter on data than video.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input placeholder="https://… audio link" {...bind('audioUrl')} />
            {cloudinaryConfigured() && (
              <label className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-medium hover:bg-surface-2">
                <Music className="size-4" /> {uploading !== null ? `${uploading}%` : 'Upload'}
                <input type="file" accept="audio/*" className="sr-only" onChange={(e) => uploadAudio(e.target.files?.[0])} />
              </label>
            )}
          </div>
          {f.audioUrl && <audio controls src={f.audioUrl} className="mt-2 w-full" preload="none" />}
        </Field>
        <Field label="Summary"><Textarea rows={4} {...bind('summary')} /></Field>
        <Field label="Thumbnail (optional — YouTube thumbnail is used automatically)"><ImageUpload value={f.thumbnailUrl} onChange={(v) => setF((s) => ({ ...s, thumbnailUrl: v }))} folder="sermons" /></Field>
        <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <Switch checked={f.status === 'published'} onCheckedChange={(v) => setF((s) => ({ ...s, status: v ? 'published' : 'draft' }))} label="Published" />
          {!existing && f.status === 'published' && <Switch checked={notify} onCheckedChange={setNotify} label="Notify members" />}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Announcements ---------------- */
const blankAnn = () => ({ title: '', body: '', pinned: false, expiresOn: '', imageUrl: '', status: 'published' as ContentStatus });

function Announcements() {
  const { data, loading } = useAnnouncements();
  const [edit, setEdit] = useState<Announcement | 'new' | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button size="sm" icon={<Plus />} onClick={() => setEdit('new')}>New announcement</Button></div>
      <Card>
        {loading ? <SkeletonRows /> : data.length === 0 ? <EmptyState icon={<Megaphone />} title="No announcements" /> : (
          <ul className="divide-y divide-line">
            {data.map((a) => {
              const expired = a.expiresOn && a.expiresOn < isoDate();
              return <Row key={a.id} title={a.title} meta={`${relative(a.createdAt)}${a.expiresOn ? ` · until ${fmtDate(a.expiresOn)}` : ''}`} body={excerpt(a.body, 120)} image={a.imageUrl} badge={<span className="flex items-center gap-2">{a.pinned && <Pin className="size-4 text-gold-600" />}{expired ? <Badge>Expired</Badge> : <StatusBadge status={a.status} />}</span>} onClick={() => setEdit(a)} />;
            })}
          </ul>
        )}
      </Card>
      <AnnouncementForm value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function AnnouncementForm({ value, onClose }: { value: Announcement | 'new' | null; onClose: () => void }) {
  const confirm = useConfirm();
  const existing = value && value !== 'new' ? value : null;
  const [f, setF] = useState(blankAnn);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(false);
  useEffect(() => {
    if (value === 'new') setF(blankAnn());
    else if (existing) setF({ ...blankAnn(), ...existing });
    setNotify(false);
  }, [value, existing]);
  async function save() {
    if (!f.title.trim() || !f.body.trim()) return toast.error('Title and message are required');
    setBusy(true);
    try {
      if (existing) await patchDoc('announcements', existing.id, f);
      else await createDoc('announcements', f, { audit: `Announcement: ${f.title}` });
      if (notify && f.status === 'published') void broadcast({ title: `📣 ${f.title}`, body: excerpt(f.body, 140), url: '/', kind: 'announcement' });
      toast.success('Saved');
      onClose();
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    if (existing && (await confirm({ title: 'Delete this announcement?', danger: true, confirmLabel: 'Delete' }))) {
      await removeDoc('announcements', existing.id);
      onClose();
    }
  }
  return (
    <Modal open={!!value} onOpenChange={(o) => !o && onClose()} title={existing ? 'Edit announcement' : 'New announcement'} footer={<>{existing && <Button variant="ghost" className="text-danger sm:mr-auto" icon={<Trash2 />} onClick={del}>Delete</Button>}<Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Field label="Message"><Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <TextField label="Show until (optional)" type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} />
        <Field label="Image (optional)"><ImageUpload value={f.imageUrl} onChange={(v) => setF((s) => ({ ...s, imageUrl: v }))} folder="announcements" /></Field>
        <div className="grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-2">
          <Switch checked={f.pinned} onCheckedChange={(v) => setF({ ...f, pinned: v })} label="Pin to top" />
          <Switch checked={f.status === 'published'} onCheckedChange={(v) => setF({ ...f, status: v ? 'published' : 'draft' })} label="Published" />
          <Switch checked={notify} onCheckedChange={setNotify} label="Send push notification" />
        </div>
      </div>
    </Modal>
  );
}
