import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/input';
import { createDoc, patchDoc } from '@/lib/db';
import type { Group, GroupType } from '@/lib/types';

export const GROUP_TYPES: { value: GroupType; label: string }[] = [
  { value: 'ministry', label: 'Ministry' },
  { value: 'department', label: 'Department' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'cell', label: 'Home cell / Bacenta' },
  { value: 'committee', label: 'Committee' },
  { value: 'class', label: 'Class (e.g. Bible study, Foundation)' },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Monthly', 'As scheduled'];

export function GroupForm({ open, onOpenChange, group, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; group?: Group | null; onSaved?: (id: string) => void }) {
  const [f, setF] = useState({ name: '', type: 'ministry' as GroupType, description: '', meetingDay: '', meetingTime: '', location: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(group ? { name: group.name, type: group.type, description: group.description ?? '', meetingDay: group.meetingDay ?? '', meetingTime: group.meetingTime ?? '', location: group.location ?? '' } : { name: '', type: 'ministry', description: '', meetingDay: '', meetingTime: '', location: '' });
  }, [open, group]);
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });

  async function save() {
    if (!f.name.trim()) return;
    setBusy(true);
    try {
      if (group) {
        await patchDoc('groups', group.id, { ...f, name: f.name.trim() }, { audit: `Updated group ${f.name}` });
        onSaved?.(group.id);
      } else {
        const id = await createDoc('groups', { ...f, name: f.name.trim(), leaderIds: [], leaderNames: [] }, { audit: `Created group ${f.name}` });
        onSaved?.(id);
      }
      toast.success('Saved');
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={group ? 'Edit group' : 'New group'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!f.name.trim()}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Name" required autoFocus placeholder="e.g. Voices of Worship (Choir)" {...bind('name')} />
        <Field label="Type">
          <Select {...bind('type')}>
            {GROUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meets on">
            <Select {...bind('meetingDay')}>
              <option value="">—</option>
              {DAYS.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <TextField label="Time" type="time" {...bind('meetingTime')} />
        </div>
        <TextField label="Location" placeholder="e.g. Church annex, or host’s home" {...bind('location')} />
        <Field label="Description">
          <Textarea rows={3} {...bind('description')} />
        </Field>
      </div>
    </Modal>
  );
}
