import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Camera, Bell, MessageSquareOff, Moon, Download, KeyRound, LogOut, Phone, Mail, MessageCircle, ChevronRight, LayoutDashboard, Pencil, Users, CalendarCheck2, Loader2 } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { toast } from 'sonner';
import { useAuth, signOut, isPhoneLogin } from '@/lib/auth';
import { useChurch } from '@/lib/settings';
import { useGroups, useMember, useMemberAttendance } from '@/lib/queries';
import { patchDoc } from '@/lib/db';
import { auth } from '@/lib/firebase';
import { cloudinaryConfigured, uploadToCloudinary } from '@/lib/cloudinary';
import { enablePush, disablePush, getPushState, type PushState } from '@/lib/push';
import { useInstallPrompt } from '@/lib/pwa';
import { formatPhone, isValidPhone, normalizePhone, telHref, whatsappHref } from '@/lib/phone';
import { fmtDate, monthDay } from '@/lib/format';
import { ROLE_META } from '@/lib/permissions';
import { STATUS_META } from '@/lib/members';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Switch, TextField } from '@/components/ui/input';
import { Modal } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/feedback';
import { ThemeSwitcher } from '@/components/user-menu';
import { Signature } from '@/components/brand';
import { MemberPage, SectionTitle } from './ui';

function Row({ icon, label, hint, action, onClick, to, danger }: { icon: React.ReactNode; label: string; hint?: string; action?: React.ReactNode; onClick?: () => void; to?: string; danger?: boolean }) {
  const inner = (
    <>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px] ${danger ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg-2'}`}>{icon}</span>
      <span className="min-w-0 flex-1"><span className={`block text-[15px] font-medium ${danger ? 'text-danger' : ''}`}>{label}</span>{hint && <span className="block text-xs text-fg-3">{hint}</span>}</span>
      {action ?? ((onClick || to) && <ChevronRight className="size-4 text-fg-3" />)}
    </>
  );
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-left';
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} active:bg-surface-2`}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export default function Profile() {
  const { profile, user, staff } = useAuth();
  const church = useChurch();
  const navigate = useNavigate();
  const install = useInstallPrompt();
  const { data: member } = useMember(profile?.memberId);
  const { data: groups } = useGroups();
  const { data: attendance } = useMemberAttendance(profile?.memberId);
  const [push, setPush] = useState<PushState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  if (!profile || !user) return null;
  const myGroups = groups.filter((g) => member?.groupIds?.includes(g.id));

  async function changePhoto(f?: File) {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(f, 'avatars');
      await patchDoc('users', user!.uid, { photoUrl: url });
      if (member) await patchDoc('members', member.id, { photoUrl: url }).catch(() => {});
      toast.success('Photo updated');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function togglePush(on: boolean) {
    try {
      setPush(on ? await enablePush(user!.uid) : await disablePush());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <MemberPage>
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Avatar name={profile.fullName} src={profile.photoUrl} size="2xl" className="ring-4 ring-surface" />
          {cloudinaryConfigured() && (
            <button type="button" onClick={() => file.current?.click()} aria-label="Change photo" className="absolute bottom-0 right-0 grid size-10 place-items-center rounded-full border-4 border-bg bg-accent text-accent-fg">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
          )}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => changePhoto(e.target.files?.[0])} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{profile.fullName}</h1>
        <p className="mt-0.5 text-sm text-fg-3">{[formatPhone(profile.phone), profile.email && !isPhoneLogin(profile.email) ? profile.email : ''].filter(Boolean).join(' · ')}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {member && <Badge tone={STATUS_META[member.membershipStatus]?.tone}>{STATUS_META[member.membershipStatus]?.label}</Badge>}
          {staff && <Badge tone={ROLE_META[profile.role].tone}>{ROLE_META[profile.role].label}</Badge>}
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" icon={<Pencil />} onClick={() => setEdit(true)}>Edit profile</Button>
          {staff && <ButtonLink to="/admin" size="sm" icon={<LayoutDashboard />}>Church admin</ButtonLink>}
        </div>
      </div>

      {member ? (
        <>
          <SectionTitle>My church life</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4"><CalendarCheck2 className="size-5 text-fg-3" /><p className="mt-2 text-xl font-semibold">{attendance.length}</p><p className="text-xs text-fg-3">check-ins recorded</p></Card>
            <Card className="p-4"><Users className="size-5 text-fg-3" /><p className="mt-2 text-xl font-semibold">{myGroups.length}</p><p className="text-xs text-fg-3">{myGroups.length === 1 ? 'group' : 'groups'}</p></Card>
          </div>
          {myGroups.length > 0 && (
            <Card className="mt-3 divide-y divide-line">
              {myGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{g.name}</span>
                  <span className="text-xs text-fg-3">{[g.meetingDay, g.meetingTime].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </Card>
          )}
          <p className="mt-2 text-xs text-fg-3">Member since {fmtDate(member.joinDate, 'MMMM yyyy')}</p>
        </>
      ) : (
        <Banner tone="brand" className="mt-6">Ask the church office to link your account to your member record to see your groups, attendance and giving.</Banner>
      )}

      <SectionTitle>Preferences</SectionTitle>
      <Card className="divide-y divide-line">
        <Row icon={<Bell />} label="Push notifications" hint={push === 'denied' ? 'Blocked in browser settings' : push === 'unsupported' ? 'Not supported on this browser' : 'Devotionals, events and replies'} action={<Switch checked={push === 'subscribed'} onCheckedChange={togglePush} disabled={push === 'denied' || push === 'unsupported' || push === null} />} />
        {member && <Row icon={<MessageSquareOff />} label="Bulk SMS" hint="Church-wide text messages" action={<Switch checked={!member.smsOptOut} onCheckedChange={(v) => patchDoc('members', member.id, { smsOptOut: !v })} />} />}
        <Row icon={<Moon />} label="Appearance" action={<ThemeSwitcher className="w-32" />} />
        {(install.canInstall || install.iosHint) && <Row icon={<Download />} label="Install the app" hint={install.canInstall ? 'Works offline, opens from your home screen' : 'Share → Add to Home Screen'} onClick={install.canInstall ? install.install : undefined} />}
        <Row icon={<KeyRound />} label="Change password" onClick={() => setPw(true)} />
      </Card>

      <SectionTitle>Contact the church</SectionTitle>
      <Card className="divide-y divide-line">
        {church.phone && <Row icon={<Phone />} label="Call the office" hint={formatPhone(church.phone)} onClick={() => (location.href = telHref(church.phone)!)} />}
        {church.phone && <Row icon={<MessageCircle />} label="WhatsApp" onClick={() => window.open(whatsappHref(church.phone), '_blank')} />}
        {church.email && <Row icon={<Mail />} label="Email" hint={church.email} onClick={() => (location.href = `mailto:${church.email}`)} />}
        <Row icon={<LogOut />} label="Sign out" danger onClick={async () => { await signOut(); navigate('/login', { replace: true }); }} />
      </Card>

      <div className="mt-8 flex flex-col items-center gap-1 pb-4 text-center">
        <p className="text-xs text-fg-3">{church.name} · v{__APP_VERSION__}</p>
        <Signature />
      </div>

      <EditProfile open={edit} onOpenChange={setEdit} />
      <ChangePassword open={pw} onOpenChange={setPw} />
    </MemberPage>
  );
}

function EditProfile({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile, user } = useAuth();
  const { data: member } = useMember(profile?.memberId);
  const [f, setF] = useState({ fullName: '', phone: '', address: '', gpsAddress: '', occupation: '', dob: '', emergencyName: '', emergencyPhone: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && profile) setF({ fullName: profile.fullName, phone: profile.phone ? '0' + profile.phone.slice(3) : '', address: member?.address ?? '', gpsAddress: member?.gpsAddress ?? '', occupation: member?.occupation ?? '', dob: member?.dob ?? '', emergencyName: member?.emergencyName ?? '', emergencyPhone: member?.emergencyPhone ? '0' + member.emergencyPhone.slice(3) : '' });
  }, [open, profile, member]);
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });
  async function save() {
    if (!f.fullName.trim()) return toast.error('Name is required');
    if (f.phone && !isValidPhone(f.phone)) return toast.error('Enter a valid phone number');
    setBusy(true);
    try {
      await patchDoc('users', user!.uid, { fullName: f.fullName.trim(), phone: normalizePhone(f.phone) });
      if (member) {
        await patchDoc('members', member.id, { phone: normalizePhone(f.phone) || member.phone, address: f.address, gpsAddress: f.gpsAddress, occupation: f.occupation, dob: f.dob, birthMonthDay: monthDay(f.dob) ?? '', emergencyName: f.emergencyName, emergencyPhone: normalizePhone(f.emergencyPhone) });
      }
      toast.success('Profile updated');
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit profile" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="space-y-4">
        <TextField label="Full name" {...bind('fullName')} />
        <TextField label="Phone" type="tel" {...bind('phone')} />
        {member && (
          <>
            <TextField label="Date of birth" type="date" {...bind('dob')} hint="So the church can celebrate your birthday" />
            <TextField label="Residential address" {...bind('address')} />
            <TextField label="GhanaPost GPS" placeholder="GA-123-4567" {...bind('gpsAddress')} />
            <TextField label="Occupation" {...bind('occupation')} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Emergency contact" {...bind('emergencyName')} />
              <TextField label="Their phone" type="tel" {...bind('emergencyPhone')} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ChangePassword({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    const u = auth.currentUser;
    if (!u?.email || next.length < 6) return toast.error('New password must be at least 6 characters');
    setBusy(true);
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
      await updatePassword(u, next);
      toast.success('Password changed');
      setCurrent('');
      setNext('');
      onOpenChange(false);
    } catch {
      toast.error('Current password is incorrect');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Change password" size="sm" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>Update</Button></>}>
      <div className="space-y-4">
        <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
    </Modal>
  );
}
