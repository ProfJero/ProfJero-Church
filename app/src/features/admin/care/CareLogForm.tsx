import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea, TextField } from '@/components/ui/input';
import { MemberPicker } from '@/components/member-picker';
import { createDoc, getActor } from '@/lib/db';
import { isoDate } from '@/lib/format';
import type { CareLogType } from '@/lib/types';

export const CARE_LOG_TYPES: { value: CareLogType; label: string }[] = [
  { value: 'visitation', label: 'Home visitation' },
  { value: 'hospital', label: 'Hospital visit' },
  { value: 'counselling', label: 'Counselling session' },
  { value: 'call', label: 'Phone call' },
  { value: 'bereavement', label: 'Bereavement support' },
  { value: 'other', label: 'Other' },
];

export function CareLogForm({ open, onOpenChange, member }: { open: boolean; onOpenChange: (o: boolean) => void; member?: { id: string; name: string } }) {
  const [person, setPerson] = useState<{ id: string | null; name: string } | null>(member ?? null);
  const [type, setType] = useState<CareLogType>('visitation');
  const [date, setDate] = useState(isoDate());
  const [summary, setSummary] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPerson(member ?? null);
      setSummary('');
      setNextStep('');
      setDate(isoDate());
    }
  }, [open, member]);

  async function save() {
    if (!person || !summary.trim()) return;
    setBusy(true);
    try {
      await createDoc('care_logs', {
        memberId: person.id,
        memberName: person.name,
        type,
        date,
        summary: summary.trim(),
        nextStep: nextStep.trim(),
        confidential: true,
        by: getActor()?.uid,
        byName: getActor()?.name,
      });
      toast.success('Care logged');
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
      title="Log pastoral care"
      description="Private to pastors and administrators."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!person || !summary.trim()}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!member && (
          <Field label="Person">
            <MemberPicker value={person} onChange={setPerson} allowFreeText />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as CareLogType)}>
              {CARE_LOG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Field label="What happened?">
          <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Visited at home, prayed with the family…" />
        </Field>
        <TextField label="Next step (optional)" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
      </div>
    </Modal>
  );
}
