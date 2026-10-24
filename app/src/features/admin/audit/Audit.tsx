import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useAuditLogs } from '@/lib/queries';
import { fmtDateTime, relative } from '@/lib/format';
import { titleCase } from '@/lib/utils';
import { downloadCsv } from '@/lib/files';
import type { AuditLog } from '@/lib/types';
import { Page, PageHeader, Toolbar } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { SearchInput, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';

const TONE: Record<string, 'success' | 'info' | 'danger' | 'neutral' | 'brand'> = { create: 'success', update: 'info', delete: 'danger', export: 'brand', import: 'brand' };

export default function Audit() {
  const { data, loading } = useAuditLogs();
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const entities = [...new Set(data.map((d) => d.entity))].sort();
  const rows = data.filter((d) => (!entity || d.entity === entity) && `${d.summary} ${d.byName}`.toLowerCase().includes(q.toLowerCase()));
  const cols: Column<AuditLog>[] = [
    { key: 'who', header: 'Who', cell: (l) => <span className="flex items-center gap-2"><Avatar name={l.byName} size="xs" /><span className="whitespace-nowrap font-medium">{l.byName}</span></span> },
    { key: 'what', header: 'What', cell: (l) => <span className="text-fg-2">{l.summary}</span> },
    { key: 'action', header: 'Action', hideBelow: 'md', cell: (l) => <Badge tone={TONE[l.action] ?? 'neutral'}>{titleCase(l.action)}</Badge> },
    { key: 'when', header: 'When', sort: (l) => l.at?.toMillis?.() ?? 0, cell: (l) => <span className="whitespace-nowrap text-fg-3" title={fmtDateTime(l.at)}>{relative(l.at)}</span> },
  ];
  return (
    <Page>
      <PageHeader title="Activity log" description="A tamper-proof record of important changes: who did what, and when." actions={<Button size="sm" variant="outline" onClick={() => downloadCsv('cwc-activity-log.csv', rows.map((l) => ({ When: fmtDateTime(l.at), Who: l.byName, Action: l.action, Area: l.entity, Summary: l.summary })))}>Export</Button>} />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search activity" className="sm:w-72" />
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="sm:w-48" aria-label="Area">
          <option value="">All areas</option>
          {entities.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
        </Select>
      </Toolbar>
      <DataTable rows={rows} columns={cols} rowKey={(l) => l.id} isLoading={loading} loading={<SkeletonRows />} defaultSort={{ key: 'when', dir: 'desc' }} pageSize={50}
        mobile={(l) => <div><p className="text-sm">{l.summary}</p><p className="mt-0.5 text-xs text-fg-3">{l.byName} · {relative(l.at)}</p></div>}
        empty={<EmptyState icon={<ScrollText />} title="No activity yet" />} />
    </Page>
  );
}
