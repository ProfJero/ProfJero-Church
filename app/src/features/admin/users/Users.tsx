import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ShieldCheck, UserPlus, MoreHorizontal, Link2, Ban, CheckCircle2, KeyRound, Sparkles, UserRoundPlus, Trash2 } from 'lucide-react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as fbSignOut, sendPasswordResetEmail, connectAuthEmulator } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth, isPhoneLogin } from '@/lib/auth';
import { useMembers, useUsers } from '@/lib/queries';
import { audit, createDoc, db, patchDoc, removeDoc } from '@/lib/db';
import { auth } from '@/lib/firebase';
import { firebaseConfig, config } from '@/config';
import { assignableRoles, ROLE_META, isStaff } from '@/lib/permissions';
import { formatPhone, normalizePhone, isValidPhone } from '@/lib/phone';
import { relative } from '@/lib/format';
import { api, apiConfigured } from '@/lib/api';
import type { Member, Role, UserProfile } from '@/lib/types';
import { Page, PageHeader, Toolbar } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { SearchInput, Field, Select, TextField } from '@/components/ui/input';
import { Modal } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { MemberPicker } from '@/components/member-picker';
import { Banner, EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { useConfirm } from '@/components/ui/confirm';
import { memberPayload, EMPTY_MEMBER } from '../people/shared';

export default function Users() {
  const { role: myRole, user: me } = useAuth();
  const confirm = useConfirm();
  const { data: users, loading } = useUsers();
  const { data: members } = useMembers();
  const [filter, setFilter] = useState<'staff' | 'members' | 'all'>('staff');
  const [q, setQ] = useState('');
  const [roleFor, setRoleFor] = useState<UserProfile | null>(null);
  const [linkFor, setLinkFor] = useState<UserProfile | null>(null);
  const [create, setCreate] = useState(false);
  const canAssign = assignableRoles(myRole ?? 'member');

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const unlinkedByPhone = useMemo(() => new Map(members.filter((m) => !m.uid && m.phone).map((m) => [m.phone, m])), [members]);
  const suggestions = users.filter((u) => !u.memberId && u.phone && unlinkedByPhone.has(normalizePhone(u.phone)));

  const rows = users.filter(
    (u) => (filter === 'all' || (filter === 'staff' ? isStaff(u.role) : u.role === 'member')) && `${u.fullName} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase()),
  );
  const editable = (u: UserProfile) => u.uid !== me?.uid && (myRole === 'super_admin' || u.role !== 'super_admin');

  async function link(u: UserProfile, m: Member) {
    const b = writeBatch(db);
    b.update(doc(db, 'users', u.id), { memberId: m.id });
    b.update(doc(db, 'members', m.id), { uid: u.uid });
    await b.commit();
    void audit('update', 'users', u.id, `Linked ${u.fullName}'s app account to ${m.fullName}`);
    toast.success(`${u.fullName} linked to ${m.fullName}`);
  }
  async function unlink(u: UserProfile) {
    const b = writeBatch(db);
    b.update(doc(db, 'users', u.id), { memberId: null });
    if (u.memberId) b.update(doc(db, 'members', u.memberId), { uid: null });
    await b.commit();
    toast.success('Unlinked');
  }
  async function createMemberFrom(u: UserProfile) {
    const [firstName, ...rest] = u.fullName.split(' ');
    const id = await createDoc('members', { ...memberPayload({ ...EMPTY_MEMBER, firstName, lastName: rest.join(' '), phone: u.phone ?? '', email: u.email, membershipStatus: 'member' }), uid: u.uid }, { audit: `Created member record for ${u.fullName}` });
    await patchDoc('users', u.id, { memberId: id });
    toast.success('Member record created and linked');
  }
  async function toggleActive(u: UserProfile) {
    const off = u.isActive !== false;
    if (off && !(await confirm({ title: `Deactivate ${u.fullName}?`, description: 'They lose access immediately. You can reactivate them later.', danger: true, confirmLabel: 'Deactivate' }))) return;
    await patchDoc('users', u.id, { isActive: !off }, { audit: `${off ? 'Deactivated' : 'Reactivated'} ${u.fullName}` });
  }
  async function resetPassword(u: UserProfile) {
    if (u.email && !isPhoneLogin(u.email)) {
      await sendPasswordResetEmail(auth, u.email);
      return toast.success(`Reset link sent to ${u.email}`);
    }
    if (!apiConfigured()) return toast.error('Phone-only accounts need the CWC Worker (with a service account) to reset passwords.');
    const temp = `Cwc-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await api(`/v1/admin/users/${u.uid}/password`, { method: 'POST', json: { password: temp } });
      toast.success(`Temporary password: ${temp}`, { duration: 30000, description: 'Share it privately; they should change it after signing in.' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function del(u: UserProfile) {
    if (!(await confirm({ title: `Remove ${u.fullName}’s access?`, description: 'Deletes their profile so they can no longer use the app. Their member record stays.', danger: true, confirmLabel: 'Remove' }))) return;
    await removeDoc('users', u.id, { audit: `Removed user ${u.fullName}` });
  }

  const cols: Column<UserProfile>[] = [
    {
      key: 'name', header: 'Name', sort: (u) => u.fullName,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.fullName} src={u.photoUrl} size="sm" />
          <div className="min-w-0"><div className="truncate font-medium">{u.fullName}{u.uid === me?.uid && <span className="ml-1.5 text-xs font-normal text-fg-3">(you)</span>}</div><div className="truncate text-xs text-fg-3">{u.email && !isPhoneLogin(u.email) ? u.email : formatPhone(u.phone)}</div></div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sort: (u) => u.role, cell: (u) => <Badge tone={ROLE_META[u.role]?.tone}>{ROLE_META[u.role]?.label}</Badge> },
    { key: 'member', header: 'Member record', hideBelow: 'md', cell: (u) => (u.memberId ? <Link to={`/admin/people/${u.memberId}`} onClick={(e) => e.stopPropagation()} className="text-sm text-accent hover:underline dark:text-brand-300">{memberById.get(u.memberId)?.fullName ?? 'Linked'}</Link> : <span className="text-xs text-fg-3">Not linked</span>) },
    { key: 'status', header: 'Status', cell: (u) => (u.isActive === false ? <Badge tone="danger">Deactivated</Badge> : <Badge tone="success" dot>Active</Badge>) },
    { key: 'seen', header: 'Last sign-in', hideBelow: 'lg', sort: (u) => u.lastLogin?.toMillis?.() ?? 0, cell: (u) => <span className="text-fg-3">{u.lastLogin ? relative(u.lastLogin) : 'Never'}</span> },
    {
      key: 'actions', header: '', className: 'w-12',
      cell: (u) => editable(u) && (
        <Menu>
          <MenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Manage ${u.fullName}`} icon={<MoreHorizontal />} onClick={(e) => e.stopPropagation()} /></MenuTrigger>
          <MenuContent>
            <MenuItem icon={<ShieldCheck />} onSelect={() => setRoleFor(u)}>Change role</MenuItem>
            {u.memberId ? <MenuItem icon={<Link2 />} onSelect={() => unlink(u)}>Unlink member record</MenuItem> : <>
              <MenuItem icon={<Link2 />} onSelect={() => setLinkFor(u)}>Link to member record</MenuItem>
              <MenuItem icon={<UserRoundPlus />} onSelect={() => createMemberFrom(u)}>Create member record</MenuItem>
            </>}
            <MenuItem icon={<KeyRound />} onSelect={() => resetPassword(u)}>Reset password</MenuItem>
            <MenuSeparator />
            <MenuItem icon={u.isActive === false ? <CheckCircle2 /> : <Ban />} onSelect={() => toggleActive(u)} danger={u.isActive !== false}>{u.isActive === false ? 'Reactivate' : 'Deactivate'}</MenuItem>
            <MenuItem icon={<Trash2 />} danger onSelect={() => del(u)}>Remove access</MenuItem>
          </MenuContent>
        </Menu>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Users & roles" description="Who can sign in, and what each person can do." actions={<Button size="sm" icon={<UserPlus />} onClick={() => setCreate(true)}>Add staff account</Button>} />
      {suggestions.length > 0 && (
        <Banner tone="brand" icon={<Sparkles />} className="mb-4" title={`${suggestions.length} app ${suggestions.length === 1 ? 'account matches' : 'accounts match'} a member by phone`} action={<Button size="xs" onClick={async () => { for (const u of suggestions) await link(u, unlinkedByPhone.get(normalizePhone(u.phone))!); }}>Link all</Button>}>
          Linking lets members see their giving history, groups and attendance in the app.
        </Banner>
      )}
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search accounts" className="sm:w-72" />
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'staff', label: `Staff (${users.filter((u) => isStaff(u.role)).length})` }, { value: 'members', label: `Members (${users.filter((u) => u.role === 'member').length})` }, { value: 'all', label: 'All' }]} />
      </Toolbar>
      <DataTable
        rows={rows}
        columns={cols}
        rowKey={(u) => u.id}
        isLoading={loading}
        loading={<SkeletonRows />}
        defaultSort={{ key: 'name', dir: 'asc' }}
        onRowClick={(u) => editable(u) && setRoleFor(u)}
        mobile={(u) => (
          <div className="flex items-center gap-3">
            <Avatar name={u.fullName} size="md" />
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{u.fullName}</div><div className="truncate text-xs text-fg-3">{u.email && !isPhoneLogin(u.email) ? u.email : formatPhone(u.phone)}</div></div>
            <Badge tone={u.isActive === false ? 'danger' : ROLE_META[u.role]?.tone}>{u.isActive === false ? 'Off' : ROLE_META[u.role]?.label}</Badge>
          </div>
        )}
        empty={<EmptyState icon={<ShieldCheck />} title="No accounts" />}
      />

      <div className="mt-8">
        <h2 className="mb-3 text-[15px] font-semibold">What each role can do</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(ROLE_META) as Role[]).map((r) => (
            <div key={r} className="card p-4">
              <Badge tone={ROLE_META[r].tone}>{ROLE_META[r].label}</Badge>
              <p className="mt-2 text-sm text-fg-2">{ROLE_META[r].description}</p>
            </div>
          ))}
        </div>
      </div>

      <RoleModal u={roleFor} onClose={() => setRoleFor(null)} roles={canAssign} />
      <Modal open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)} title="Link to a member record" description={linkFor?.fullName} size="sm" footer={<Button variant="outline" onClick={() => setLinkFor(null)}>Close</Button>}>
        <div className="min-h-72">
          <MemberPicker value={null} onChange={async (v) => { if (v?.member && linkFor) { await link(linkFor, v.member); setLinkFor(null); } }} autoFocus />
        </div>
      </Modal>
      <CreateStaff open={create} onOpenChange={setCreate} roles={canAssign.filter((r) => r !== 'member')} />
    </Page>
  );
}

function RoleModal({ u, onClose, roles }: { u: UserProfile | null; onClose: () => void; roles: Role[] }) {
  const [role, setRole] = useState<Role>('member');
  const [last, setLast] = useState<string | null>(null);
  if (u && u.id !== last) {
    setLast(u.id);
    setRole(u.role);
  }
  async function save() {
    if (!u) return;
    await patchDoc('users', u.id, { role }, { audit: `Changed ${u.fullName}'s role to ${ROLE_META[role].label}` });
    toast.success(`${u.fullName} is now ${ROLE_META[role].label}`);
    onClose();
  }
  return (
    <Modal open={!!u} onOpenChange={(o) => !o && onClose()} title="Change role" description={u?.fullName} size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={role === u?.role}>Save</Button></>}>
      <div className="space-y-2">
        {roles.map((r) => (
          <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${role === r ? 'border-brand-500 bg-accent-soft' : 'border-line hover:bg-surface-2'}`}>
            <input type="radio" name="role" className="mt-1 accent-[var(--color-accent)]" checked={role === r} onChange={() => setRole(r)} />
            <span><span className="block text-sm font-medium">{ROLE_META[r].label}</span><span className="block text-xs text-fg-3">{ROLE_META[r].description}</span></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

/**
 * Creates the Auth user through a throwaway secondary Firebase app so the
 * admin stays signed in, then writes the profile with the admin's own session.
 */
function CreateStaff({ open, onOpenChange, roles }: { open: boolean; onOpenChange: (o: boolean) => void; roles: Role[] }) {
  const [f, setF] = useState({ fullName: '', email: '', phone: '', role: 'secretary' as Role, password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setError('');
    if (!f.fullName.trim() || !f.email.includes('@') || f.password.length < 8) return setError('Name, a valid email and a password of 8+ characters are required.');
    if (f.phone && !isValidPhone(f.phone)) return setError('Invalid phone number.');
    setBusy(true);
    const secondary = initializeApp(firebaseConfig, `staff-${Date.now()}`);
    try {
      const a2 = getAuth(secondary);
      if (config.useEmulators) connectAuthEmulator(a2, 'http://127.0.0.1:9099', { disableWarnings: true });
      const cred = await createUserWithEmailAndPassword(a2, f.email.trim(), f.password);
      await setDoc(doc(db, 'users', cred.user.uid), { uid: cred.user.uid, email: f.email.trim().toLowerCase(), fullName: f.fullName.trim(), phone: normalizePhone(f.phone), role: f.role, isActive: true, memberId: null, createdAt: serverTimestamp() });
      await fbSignOut(a2);
      void audit('create', 'users', cred.user.uid, `Created ${ROLE_META[f.role].label} account for ${f.fullName}`);
      toast.success(`Account created for ${f.fullName}`, { description: 'Share the email and password privately.' });
      setF({ fullName: '', email: '', phone: '', role: 'secretary', password: '' });
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message.replace('Firebase: ', ''));
    } finally {
      await deleteApp(secondary).catch(() => {});
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add a staff account" description="For pastors, secretaries, treasurers and ushers. Members can sign up themselves in the app." footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>Create account</Button></>}>
      <div className="space-y-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <TextField label="Full name" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <TextField label="Phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].description}</option>)}
          </Select>
        </Field>
        <TextField label="Temporary password" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} hint="At least 8 characters. Ask them to change it after signing in." />
      </div>
    </Modal>
  );
}
