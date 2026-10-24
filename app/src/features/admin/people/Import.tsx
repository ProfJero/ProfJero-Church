import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Page, PageHeader } from '@/components/ui/page';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/feedback';
import { downloadCsv, parseCsv } from '@/lib/files';
import { createMany, audit } from '@/lib/db';
import { useGroups, useMembers } from '@/lib/queries';
import { isValidPhone, normalizePhone, formatPhone } from '@/lib/phone';
import { isoDate } from '@/lib/format';
import { EMPTY_MEMBER, memberPayload, STATUS_META, type MemberInput } from './shared';
import type { MembershipStatus } from '@/lib/types';

/** Target fields and the header spellings we recognise for each. */
const FIELDS: { key: string; label: string; aliases: string[] }[] = [
  { key: 'fullName', label: 'Full name (split automatically)', aliases: ['name', 'full name', 'fullname', 'member name', 'names'] },
  { key: 'firstName', label: 'First name', aliases: ['first name', 'firstname', 'given name', 'forename'] },
  { key: 'lastName', label: 'Last name', aliases: ['last name', 'lastname', 'surname', 'family name'] },
  { key: 'otherNames', label: 'Other names', aliases: ['other names', 'middle name', 'othernames'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'contact', 'telephone', 'tel', 'msisdn', 'number'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'email address'] },
  { key: 'gender', label: 'Gender', aliases: ['gender', 'sex'] },
  { key: 'dob', label: 'Date of birth', aliases: ['dob', 'date of birth', 'birthday', 'birth date'] },
  { key: 'address', label: 'Address', aliases: ['address', 'residence', 'location', 'area'] },
  { key: 'gpsAddress', label: 'GPS address', aliases: ['gps', 'gps address', 'digital address', 'ghanapost gps'] },
  { key: 'occupation', label: 'Occupation', aliases: ['occupation', 'profession', 'job'] },
  { key: 'membershipStatus', label: 'Status', aliases: ['status', 'membership', 'membership status', 'category'] },
  { key: 'groups', label: 'Groups (; separated)', aliases: ['group', 'groups', 'ministry', 'ministries', 'department', 'cell'] },
  { key: 'joinDate', label: 'Date joined', aliases: ['joined', 'date joined', 'join date', 'membership date'] },
  { key: 'maritalStatus', label: 'Marital status', aliases: ['marital status', 'married'] },
  { key: 'hometown', label: 'Hometown', aliases: ['hometown', 'home town'] },
];

function guess(header: string) {
  const h = header.toLowerCase().trim();
  return FIELDS.find((f) => f.aliases.includes(h))?.key ?? '';
}

/** Accepts 2026-10-24, 24/10/2026, 24-10-2026, 10/24/2026 (if unambiguous). */
function toIsoDate(v: string) {
  const s = v.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (Number(y) > 30 ? '19' : '20') + y;
    let day = Number(a);
    let mon = Number(b);
    if (mon > 12 && day <= 12) [day, mon] = [mon, day];
    return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : isoDate(d);
}

function toStatus(v: string): MembershipStatus {
  const s = v.toLowerCase().replace(/[\s-]+/g, '_');
  if (s in STATUS_META) return s as MembershipStatus;
  if (s.includes('first')) return 'first_timer';
  if (s.includes('visit')) return 'visitor';
  if (s.includes('convert')) return 'new_convert';
  if (s.includes('lead')) return 'leader';
  if (s.includes('work')) return 'worker';
  if (s.includes('inact')) return 'inactive';
  return 'member';
}

export default function Import() {
  const navigate = useNavigate();
  const { data: existing } = useMembers();
  const { data: groups } = useGroups();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [skipDupes, setSkipDupes] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);

  const headers = rows.length ? Object.keys(rows[0]) : [];

  async function load(f?: File) {
    if (!f) return;
    try {
      const data = await parseCsv(f);
      if (!data.length) return toast.error('That file has no rows.');
      setFile(f);
      setRows(data);
      const m: Record<string, string> = {};
      Object.keys(data[0]).forEach((h) => (m[h] = guess(h)));
      setMap(m);
    } catch {
      toast.error('Could not read that file. Save it as CSV and try again.');
    }
  }

  const existingPhones = useMemo(() => new Set(existing.map((m) => m.phone).filter(Boolean)), [existing]);
  const groupByName = useMemo(() => new Map(groups.map((g) => [g.name.toLowerCase(), g.id])), [groups]);

  const parsed = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((r) => {
      const v = (key: string) => {
        const h = Object.keys(map).find((k) => map[k] === key);
        return h ? (r[h] ?? '').trim() : '';
      };
      let firstName = v('firstName');
      let lastName = v('lastName');
      if (!firstName && v('fullName')) {
        const parts = v('fullName').split(/\s+/);
        firstName = parts[0] ?? '';
        lastName = parts.length > 1 ? parts[parts.length - 1] : '';
      }
      const phone = normalizePhone(v('phone'));
      const g = v('gender').toLowerCase();
      const member: MemberInput = {
        ...EMPTY_MEMBER,
        firstName,
        lastName,
        otherNames: v('otherNames') || (v('fullName') ? v('fullName').split(/\s+/).slice(1, -1).join(' ') : ''),
        phone,
        email: v('email'),
        gender: g.startsWith('f') ? 'female' : g.startsWith('m') ? 'male' : '',
        dob: toIsoDate(v('dob')),
        address: v('address'),
        gpsAddress: v('gpsAddress'),
        occupation: v('occupation'),
        hometown: v('hometown'),
        membershipStatus: v('membershipStatus') ? toStatus(v('membershipStatus')) : 'member',
        joinDate: toIsoDate(v('joinDate')) || isoDate(),
        maritalStatus: (['single', 'married', 'widowed', 'divorced'].find((s) => v('maritalStatus').toLowerCase().startsWith(s)) ?? '') as MemberInput['maritalStatus'],
        groupIds: v('groups')
          .split(/[;,|]/)
          .map((n) => groupByName.get(n.trim().toLowerCase()))
          .filter(Boolean) as string[],
      };
      const problems: string[] = [];
      if (!firstName) problems.push('missing name');
      if (v('phone') && !isValidPhone(v('phone'))) problems.push('invalid phone');
      const duplicate = !!phone && (existingPhones.has(phone) || seen.has(phone));
      if (phone) seen.add(phone);
      return { member, problems, duplicate };
    });
  }, [rows, map, existingPhones, groupByName]);

  const importable = parsed.filter((p) => p.problems.length === 0 && !(skipDupes && p.duplicate));
  const hasName = Object.values(map).some((v) => v === 'firstName' || v === 'fullName');

  async function run() {
    setProgress(0);
    try {
      await createMany('members', importable.map((p) => memberPayload(p.member)), setProgress);
      void audit('import', 'members', undefined, `Imported ${importable.length} people from ${file?.name}`);
      toast.success(`Imported ${importable.length} people`);
      navigate('/admin/people');
    } catch (e) {
      toast.error((e as Error).message);
      setProgress(null);
    }
  }

  function template() {
    downloadCsv('cwc-people-template.csv', [
      { 'First name': 'Ama', 'Last name': 'Mensah', Phone: '0241234567', Email: 'ama@example.com', Gender: 'Female', 'Date of birth': '14/02/1990', Address: 'Adenta, Accra', 'GPS address': 'GD-123-4567', Occupation: 'Teacher', Status: 'Member', Groups: "Women's Fellowship; Voices of Worship (Choir)", 'Date joined': '01/03/2019' },
    ]);
  }

  return (
    <Page width="narrow">
      <PageHeader
        back={{ to: '/admin/people', label: 'People' }}
        title="Import people"
        description="Bring in your existing register from Excel or Google Sheets (save or download as CSV)."
        actions={
          <Button variant="outline" size="sm" icon={<Download />} onClick={template}>
            Template
          </Button>
        }
      />

      {!rows.length ? (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            load(e.dataTransfer.files?.[0]);
          }}
          className="card flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed px-6 py-16 text-center transition-colors hover:border-brand-400"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-soft-fg">
            <FileSpreadsheet className="size-6" />
          </span>
          <span className="text-[15px] font-semibold">Choose a CSV file</span>
          <span className="max-w-sm text-sm text-fg-3">We’ll match your columns automatically. Ghana numbers like 024 123 4567 are fine.</span>
          <span className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
            <Upload className="size-4" /> Select file
          </span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Match columns" description={`${file?.name} · ${rows.length} rows`} action={<Button size="sm" variant="ghost" onClick={() => setRows([])}>Change file</Button>} />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{h}</div>
                    <div className="truncate text-xs text-fg-3">e.g. {rows.find((r) => r[h])?.[h] ?? '—'}</div>
                  </div>
                  <Select value={map[h] ?? ''} onChange={(e) => setMap((m) => ({ ...m, [h]: e.target.value }))} className="w-44" aria-label={`Map ${h}`}>
                    <option value="">Don’t import</option>
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          {!hasName && <Banner tone="warning" icon={<AlertTriangle />}>Map a name column (first name or full name) to continue.</Banner>}

          <Card>
            <CardHeader title="Preview" description={`${importable.length} ready · ${parsed.filter((p) => p.duplicate).length} possible duplicates · ${parsed.filter((p) => p.problems.length).length} with problems`} />
            <div className="max-h-96 overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs text-fg-3">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Phone</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {parsed.slice(0, 200).map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{[p.member.firstName, p.member.lastName].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-2 tabular text-fg-2">{formatPhone(p.member.phone) || '—'}</td>
                      <td className="px-4 py-2">{STATUS_META[p.member.membershipStatus].label}</td>
                      <td className="px-4 py-2">
                        {p.problems.length ? <Badge tone="danger">{p.problems.join(', ')}</Badge> : p.duplicate ? <Badge tone="warning">Duplicate phone</Badge> : <Badge tone="success">OK</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-fg-2">
                <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} />
                Skip people whose phone is already in the directory
              </label>
              <Button icon={<CheckCircle2 />} onClick={run} loading={progress !== null} disabled={!hasName || importable.length === 0}>
                {progress !== null ? `Importing ${progress}/${importable.length}` : `Import ${importable.length} people`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}
