import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Select, TextField } from '@/components/ui/input';
import { createDoc, patchDoc } from '@/lib/db';
import { isoDate } from '@/lib/format';
import { useChurch } from '@/lib/settings';
import type { Service } from '@/lib/types';

export function ServiceForm({ open, onOpenChange, service, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; service?: Service | null; onSaved?: (id: string) => void }) {
  const church = useChurch();
  const [f, setF] = useState({ type: '', date: isoDate(), startTime: '', preacher: '', theme: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const guess = now.getDay() === 0 ? (now.getHours() < 9 ? church.serviceTypes[0] : church.serviceTypes[1] ?? church.serviceTypes[0]) : now.getDay() === 3 ? 'Midweek Service' : church.serviceTypes[0];
    setF(service ? { type: service.type, date: service.date, startTime: service.startTime ?? '', preacher: service.preacher ?? '', theme: service.theme ?? '' } : { type: guess ?? '', date: isoDate(), startTime: '', preacher: '', theme: '' });
  }, [open, service, church.serviceTypes]);
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value })) });

  async function save() {
    if (!f.type || !f.date) return;
    setBusy(true);
    try {
      if (service) {
        await patchDoc('services', service.id, { ...f, title: f.type });
        onSaved?.(service.id);
      } else {
        const id = await createDoc('services', { ...f, title: f.type, isOpen: true, headcount: { men: 0, women: 0, children: 0, visitors: 0 }, checkins: 0, firstTimers: 0 }, { audit: `Started ${f.type} (${f.date})` });
        onSaved?.(id);
      }
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
      title={service ? 'Edit service' : 'Start a service'}
      description={service ? undefined : 'Opens check-in for ushers and members (QR self check-in).'}
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={busy}>{service ? 'Save' : 'Start service'}</Button></>}
    >
      <div className="space-y-4">
        <Field label="Service">
          <Select {...bind('type')}>
            {church.serviceTypes.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" {...bind('date')} />
          <TextField label="Start time" type="time" {...bind('startTime')} />
        </div>
        <TextField label="Preacher / minister" {...bind('preacher')} />
        <TextField label="Theme / topic" {...bind('theme')} />
      </div>
    </Modal>
  );
}
