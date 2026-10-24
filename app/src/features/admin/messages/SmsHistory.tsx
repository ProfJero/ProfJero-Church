import { useState } from 'react';
import { RefreshCw, MessageSquareText, CalendarX } from 'lucide-react';
import { toast } from 'sonner';
import { useSmsMessages } from '@/lib/queries';
import { api, ApiError } from '@/lib/api';
import { patchDoc } from '@/lib/db';
import { fmtDateTime, num, relative } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import type { SmsMessage } from '@/lib/types';
import type { BadgeTone } from '@/lib/permissions';
import { DataTable, type Column } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { EmptyState, SkeletonRows, Spinner } from '@/components/ui/feedback';
import { Segmented } from '@/components/ui/tabs';
import { useConfirm } from '@/components/ui/confirm';
import { batchPatch, getBatch, type PjBatch, type PjRecord } from './sms-client';

export const SMS_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  sending: { label: 'Sending', tone: 'info' },
  submitting: { label: 'Sending', tone: 'info' },
  completed: { label: 'Sent', tone: 'success' },
  partial: { label: 'Partly sent', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  scheduled: { label: 'Scheduled', tone: 'brand' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const RECORD_STATUS: Record<string, BadgeTone> = { delivered: 'success', submitted: 'info', queued: 'neutral', submitting: 'neutral', failed: 'danger', unknown: 'warning' };

export function SmsHistory() {
  const { data, loading } = useSmsMessages();
  const [filter, setFilter] = useState<'all' | 'scheduled'>('all');
  const [open, setOpen] = useState<SmsMessage | null>(null);
  const rows = data.filter((m) => filter === 'all' || m.status === 'scheduled');

  const cols: Column<SmsMessage>[] = [
    { key: 'msg', header: 'Message', cell: (m) => <div className="max-w-md"><div className="line-clamp-1 font-medium">{m.message}</div><div className="truncate text-xs text-fg-3">{m.audience}</div></div> },
    { key: 'to', header: 'To', align: 'right', sort: (m) => m.recipients, cell: (m) => num(m.recipients) },
    { key: 'units', header: 'Units', align: 'right', hideBelow: 'md', cell: (m) => (m.unitsCharged != null ? num(m.unitsCharged) : m.unitsReserved != null ? `~${num(m.unitsReserved)}` : '—') },
    { key: 'status', header: 'Status', cell: (m) => <Badge tone={SMS_STATUS[m.status]?.tone}>{SMS_STATUS[m.status]?.label ?? m.status}</Badge> },
    { key: 'when', header: 'When', hideBelow: 'lg', sort: (m) => m.createdAt?.toMillis?.() ?? 0, cell: (m) => <span className="whitespace-nowrap text-fg-2">{m.status === 'scheduled' && m.scheduledAt ? fmtDateTime(m.scheduledAt) : relative(m.createdAt)}</span> },
  ];

  return (
    <>
      <Segmented className="mb-3" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All messages' }, { value: 'scheduled', label: `Scheduled (${data.filter((m) => m.status === 'scheduled').length})` }]} />
      <DataTable
        rows={rows}
        columns={cols}
        rowKey={(m) => m.id}
        onRowClick={setOpen}
        isLoading={loading}
        loading={<SkeletonRows />}
        mobile={(m) => (
          <div>
            <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{m.audience}</span><Badge tone={SMS_STATUS[m.status]?.tone}>{SMS_STATUS[m.status]?.label}</Badge></div>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-3">{m.message}</p>
            <p className="mt-1 text-xs text-fg-3">{num(m.recipients)} recipients · {relative(m.createdAt)}</p>
          </div>
        )}
        empty={<EmptyState icon={<MessageSquareText />} title={filter === 'all' ? 'No messages sent yet' : 'Nothing scheduled'} />}
      />
      <MessageDetail m={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MessageDetail({ m, onClose }: { m: SmsMessage | null; onClose: () => void }) {
  const confirm = useConfirm();
  const [batch, setBatch] = useState<{ batch: PjBatch; records: PjRecord[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (m && m.id !== lastId) {
    setLastId(m.id);
    setBatch(null);
  }

  async function refresh() {
    if (!m) return;
    setLoading(true);
    try {
      const b = await getBatch(m.id);
      setBatch(b);
      await patchDoc('sms_messages', m.id, batchPatch(b.batch));
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    if (!m?.campaignId) return;
    if (!(await confirm({ title: 'Cancel this scheduled message?', description: 'It won’t be sent and no units will be charged.', danger: true, confirmLabel: 'Cancel message' }))) return;
    try {
      await api(`/v1/sms/campaigns/${encodeURIComponent(m.campaignId)}/cancel`, { method: 'POST' });
      await patchDoc('sms_messages', m.id, { status: 'cancelled' });
      toast.success('Scheduled message cancelled');
      onClose();
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  }

  const canTrack = m && !['scheduled', 'cancelled'].includes(m.status) && !m.id.startsWith('seed');
  return (
    <Modal
      open={!!m}
      onOpenChange={(o) => !o && onClose()}
      title={m?.audience ?? ''}
      description={m ? `${SMS_STATUS[m.status]?.label} · ${fmtDateTime(m.createdAt)} · by ${m.createdByName || '—'}` : ''}
      side
      footer={
        <>
          {m?.status === 'scheduled' && m.campaignId && <Button variant="danger" icon={<CalendarX />} onClick={cancel}>Cancel send</Button>}
          {canTrack && <Button variant="outline" icon={<RefreshCw />} onClick={refresh} loading={loading}>Check delivery</Button>}
        </>
      }
    >
      {m && (
        <div className="space-y-5">
          <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{m.message}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Recipients', m.recipients], ['Delivered', batch?.batch.deliveredCount ?? m.delivered], ['Failed', batch?.batch.failedCount ?? m.failed]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-line p-3"><div className="text-lg font-semibold">{v == null ? '—' : num(v as number)}</div><div className="text-xs text-fg-3">{l}</div></div>
            ))}
          </div>
          {m.error && <p className="text-sm text-danger">{m.error}</p>}
          {m.status === 'scheduled' && <p className="text-sm text-fg-3">Sends {fmtDateTime(m.scheduledAt)}. Units are charged at send time.</p>}
          {loading && !batch && <Spinner />}
          {batch && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Per-recipient status</h4>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {batch.records.slice(0, 300).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="tabular">{formatPhone(r.recipient)}</span>
                    <Badge tone={RECORD_STATUS[r.status] ?? 'neutral'}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!batch && canTrack && <p className="text-xs text-fg-3">Tap “Check delivery” for live per-number status from ProfJero Connect.</p>}
        </div>
      )}
    </Modal>
  );
}
