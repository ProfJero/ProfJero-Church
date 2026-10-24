import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, TextField, Textarea } from '@/components/ui/input';
import { ImageUpload } from '@/components/image-upload';
import { createDoc, patchDoc } from '@/lib/db';
import { useGroups } from '@/lib/queries';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { monthDay, isoDate } from '@/lib/format';
import { cn, searchKeywords } from '@/lib/utils';
import type { BadgeTone } from '@/lib/permissions';
import type { Member, MembershipStatus } from '@/lib/types';
import { useChurch } from '@/lib/settings';
import { sendSms } from '@/features/admin/messages/sms-client';

export const STATUS_META: Record<MembershipStatus, { label: string; tone: BadgeTone }> = {
  visitor: { label: 'Visitor', tone: 'neutral' },
  first_timer: { label: 'First-timer', tone: 'gold' },
  new_convert: { label: 'New convert', tone: 'info' },
  member: { label: 'Member', tone: 'brand' },
  worker: { label: 'Worker', tone: 'success' },
  leader: { label: 'Leader', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'warning' },
  transferred: { label: 'Transferred', tone: 'neutral' },
  deceased: { label: 'Deceased', tone: 'neutral' },
};

export const REGIONS = [
  'Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Volta', 'Western', 'Western North', 'Northern', 'Savannah',
  'North East', 'Upper East', 'Upper West', 'Bono', 'Bono East', 'Ahafo', 'Oti', 'Outside Ghana',
];

export type MemberInput = Omit<Member, 'id' | 'fullName' | 'keywords' | 'birthMonthDay' | 'createdAt' | 'updatedAt' | 'createdBy'>;

export const EMPTY_MEMBER: MemberInput = {
  firstName: '', lastName: '', otherNames: '', title: '', gender: '', dob: '', phone: '', altPhone: '', email: '',
  address: '', gpsAddress: '', hometown: '', region: '', occupation: '', maritalStatus: '', anniversary: '',
  membershipStatus: 'member', joinDate: isoDate(), baptismDate: '', salvationDate: '', groupIds: [], householdId: null,
  householdRole: '', photoUrl: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '', notes: '', tags: [],
  uid: null, howHeard: '', invitedBy: '', smsOptOut: false,
};

/** Normalises a member record before it is written. */
export function memberPayload(m: Partial<MemberInput>) {
  const firstName = (m.firstName ?? '').trim();
  const lastName = (m.lastName ?? '').trim();
  const fullName = [firstName, m.otherNames?.trim(), lastName].filter(Boolean).join(' ');
  const phone = normalizePhone(m.phone);
  return {
    ...m,
    firstName,
    lastName,
    fullName,
    phone,
    altPhone: normalizePhone(m.altPhone),
    emergencyPhone: normalizePhone(m.emergencyPhone),
    email: (m.email ?? '').trim().toLowerCase(),
    birthMonthDay: monthDay(m.dob) ?? '',
    keywords: searchKeywords(fullName, phone.slice(-9), phone.slice(-9).replace(/^(\d{2})/, '0$1'), m.email),
  };
}

export function PersonForm({
  open,
  onOpenChange,
  member,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  member?: Member | null;
  defaults?: Partial<MemberInput>;
  onSaved?: (id: string) => void;
}) {
  const church = useChurch();
  const { data: groups } = useGroups();
  const [form, setForm] = useState<MemberInput>(EMPTY_MEMBER);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendWelcome, setSendWelcome] = useState(true);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (member) {
      const { id: _id, fullName: _f, keywords: _k, birthMonthDay: _b, createdAt: _c, updatedAt: _u, createdBy: _cb, ...rest } = member;
      setForm({ ...EMPTY_MEMBER, ...rest, phone: member.phone ? '0' + member.phone.slice(3) : '' });
    } else setForm({ ...EMPTY_MEMBER, ...defaults });
  }, [open, member, defaults]);

  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const bind = (k: keyof MemberInput) => ({
    value: (form[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });

  const groupOptions = useMemo(() => groups.map((g) => ({ id: g.id, name: g.name })), [groups]);
  const isNewFirstTimer = !member && form.membershipStatus === 'first_timer';

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'Required';
    if (!form.lastName.trim()) errs.lastName = 'Required';
    if (form.phone && !isValidPhone(form.phone)) errs.phone = 'Enter a valid number, e.g. 024 123 4567';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Invalid email';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const payload = memberPayload(form);
      let id: string;
      if (member) {
        await patchDoc('members', member.id, payload, { audit: `Updated ${payload.fullName}` });
        id = member.id;
        toast.success('Profile updated');
      } else {
        id = await createDoc('members', payload, { audit: `Added ${payload.fullName}` });
        toast.success(`${payload.firstName} added to the directory`);
        if (['first_timer', 'new_convert'].includes(payload.membershipStatus ?? '')) {
          await createDoc('followups', {
            memberId: id,
            name: payload.fullName,
            phone: payload.phone,
            kind: payload.membershipStatus,
            stage: 'new',
            assignedTo: null,
            assignedName: '',
            dueDate: isoDate(new Date(Date.now() + 3 * 864e5)),
            notes: [],
          });
          if (payload.membershipStatus === 'first_timer' && sendWelcome && payload.phone && church.welcomeSms && church.smsSenderId) {
            sendSms({
              message: church.welcomeSms,
              recipients: [{ phone: payload.phone, fields: { first_name: payload.firstName, name: payload.fullName } }],
              audience: `Welcome — ${payload.fullName}`,
              senderId: church.smsSenderId,
            })
              .then(() => toast.success('Welcome SMS sent'))
              .catch((err) => toast.error(`Welcome SMS not sent: ${err.message}`));
          }
        }
      }
      onSaved?.(id);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Edit ${member.firstName}` : 'Add a person'}
      description={member ? undefined : 'Only first and last name are required — you can fill the rest later.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="person-form" loading={busy}>
            {member ? 'Save changes' : 'Add person'}
          </Button>
        </>
      }
    >
      <form id="person-form" onSubmit={submit} className="space-y-7" noValidate>
        <FormSection title="Basic details">
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <div className="max-w-40">
              <ImageUpload value={form.photoUrl} onChange={(v) => set('photoUrl', v)} folder="members" aspect="aspect-square" label="Photo" />
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <Field label="Title">
                <Select {...bind('title')}>
                  <option value="">—</option>
                  {['Bro.', 'Sis.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Elder', 'Deacon', 'Deaconess', 'Pastor', 'Rev.', 'Apostle', 'Prophet', 'Nana', 'Hon.'].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Gender">
                <Select {...bind('gender')}>
                  <option value="">—</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </Select>
              </Field>
              <TextField label="First name" required autoFocus={!member} error={errors.firstName} {...bind('firstName')} />
              <TextField label="Last name" required error={errors.lastName} {...bind('lastName')} />
              <TextField label="Other names" {...bind('otherNames')} />
              <TextField label="Date of birth" type="date" max={isoDate()} {...bind('dob')} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Phone" type="tel" inputMode="tel" placeholder="024 123 4567" error={errors.phone} {...bind('phone')} />
            <TextField label="Alternative phone" type="tel" inputMode="tel" {...bind('altPhone')} />
            <TextField label="Email" type="email" error={errors.email} {...bind('email')} />
            <TextField label="Occupation" {...bind('occupation')} />
            <TextField label="Residential address" placeholder="Area, town" {...bind('address')} />
            <TextField label="GhanaPost GPS" placeholder="GA-123-4567" {...bind('gpsAddress')} />
            <TextField label="Hometown" {...bind('hometown')} />
            <Field label="Home region">
              <Select {...bind('region')}>
                <option value="">—</option>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Church life">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Membership status">
              <Select {...bind('membershipStatus')}>
                {Object.entries(STATUS_META).map(([v, m]) => (
                  <option key={v} value={v}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <TextField label="Date joined / first visit" type="date" {...bind('joinDate')} />
            <TextField label="Water baptism" type="date" {...bind('baptismDate')} />
            <TextField label="Salvation date" type="date" {...bind('salvationDate')} />
            {(form.membershipStatus === 'first_timer' || form.membershipStatus === 'visitor') && (
              <>
                <Field label="How did they hear about us?">
                  <Select {...bind('howHeard')}>
                    <option value="">—</option>
                    {['Friend or family', 'Social media', 'Radio / TV', 'Walked in', 'Crusade / outreach', 'Flyer', 'Online search', 'Other'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
                <TextField label="Invited by" {...bind('invitedBy')} />
              </>
            )}
          </div>
          {groupOptions.length > 0 && (
            <Field label="Groups & ministries" className="mt-4">
              <div className="flex flex-wrap gap-2">
                {groupOptions.map((g) => {
                  const on = form.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('groupIds', on ? form.groupIds.filter((x) => x !== g.id) : [...form.groupIds, g.id])}
                      className={cn(
                        'h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
                        on ? 'border-transparent bg-accent text-accent-fg' : 'border-line-strong text-fg-2 hover:bg-surface-2',
                      )}
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
          {isNewFirstTimer && church.welcomeSms && church.smsSenderId && (
            <label className="mt-4 flex items-center gap-2.5 text-sm text-fg-2">
              <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
              Send the welcome SMS now
            </label>
          )}
        </FormSection>

        <FormSection title="Family & emergency contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marital status">
              <Select {...bind('maritalStatus')}>
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="widowed">Widowed</option>
                <option value="divorced">Divorced</option>
              </Select>
            </Field>
            {form.maritalStatus === 'married' ? <TextField label="Wedding anniversary" type="date" {...bind('anniversary')} /> : <div className="hidden sm:block" />}
            <TextField label="Emergency contact name" {...bind('emergencyName')} />
            <TextField label="Emergency contact phone" type="tel" {...bind('emergencyPhone')} />
            <TextField label="Relationship" placeholder="e.g. Spouse, Mother" {...bind('emergencyRelation')} />
          </div>
        </FormSection>

        <FormSection title="Notes">
          <Field label="Tags" hint="Comma separated, e.g. instrumentalist, driver, sign language">
            <Input value={form.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
          </Field>
          <Field label="Private notes" className="mt-4">
            <Textarea rows={3} {...bind('notes')} />
          </Field>
          <label className="mt-4 flex items-center gap-2.5 text-sm text-fg-2">
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={!!form.smsOptOut} onChange={(e) => set('smsOptOut', e.target.checked)} />
            Opted out of bulk SMS
          </label>
        </FormSection>
      </form>
    </Modal>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-3">{title}</legend>
      {children}
    </fieldset>
  );
}
