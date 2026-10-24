import { useState } from 'react';
import { Plus, FileText, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSmsTemplates } from '@/lib/queries';
import { createDoc, patchDoc, removeDoc } from '@/lib/db';
import { segmentInfo } from '@/lib/sms';
import type { SmsTemplate } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Field, Select, Textarea, TextField } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/feedback';
import { useConfirm } from '@/components/ui/confirm';

const CATS = ['Reminder', 'Welcome', 'Birthday', 'Follow-up', 'Event', 'Giving', 'Condolence', 'General'];

export function Templates() {
  const { data } = useSmsTemplates();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<SmsTemplate | 'new' | null>(null);
  const [f, setF] = useState({ name: '', body: '', category: 'General' });
  const [busy, setBusy] = useState(false);

  const openEdit = (t: SmsTemplate | 'new') => {
    setEdit(t);
    setF(t === 'new' ? { name: '', body: '', category: 'General' } : { name: t.name, body: t.body, category: t.category });
  };
  async function save() {
    if (!f.name.trim() || !f.body.trim()) return;
    setBusy(true);
    try {
      if (edit === 'new') await createDoc('sms_templates', f);
      else if (edit) await patchDoc('sms_templates', edit.id, f);
      toast.success('Template saved');
      setEdit(null);
    } finally {
      setBusy(false);
    }
  }
  async function del(t: SmsTemplate) {
    if (await confirm({ title: `Delete “${t.name}”?`, danger: true, confirmLabel: 'Delete' })) await removeDoc('sms_templates', t.id);
  }

  return (
    <>
      <div className="mb-3 flex justify-end"><Button size="sm" icon={<Plus />} onClick={() => openEdit('new')}>New template</Button></div>
      {data.length === 0 ? (
        <Card><EmptyState icon={<FileText />} title="No templates yet" description="Save messages you send often — reminders, birthday wishes, welcomes." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((t) => (
            <Card key={t.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{t.name}</h3>
                <Badge>{t.category}</Badge>
              </div>
              <p className="mt-2 line-clamp-4 flex-1 text-sm text-fg-2">{t.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-fg-3">
                <span>{segmentInfo(t.body).pages} page(s)</span>
                <span className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Edit" icon={<Pencil />} onClick={() => openEdit(t)} />
                  <Button size="icon-sm" variant="ghost" aria-label="Delete" icon={<Trash2 />} onClick={() => del(t)} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === 'new' ? 'New template' : 'Edit template'} footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
        <div className="space-y-4">
          <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Message" hint={`${segmentInfo(f.body).length} chars · use {first_name|Beloved} to personalise`}><Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}
