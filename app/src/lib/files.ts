import Papa from 'papaparse';

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows);
  // BOM so Excel opens UTF-8 (names with accents, ₵) correctly
  downloadBlob(filename, new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
}

export function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}

/** iCalendar file so members can add events to their phone calendar. */
export function icsFor(ev: { id: string; title: string; startAt: string; endAt?: string; location?: string; description?: string }) {
  const stamp = (s: string) => {
    const d = new Date(s);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const end = ev.endAt || new Date(new Date(ev.startAt).getTime() + 2 * 3600e3).toISOString();
  const esc = (s = '') => s.replace(/[\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProfJero//CWC//EN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@cwc`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(ev.startAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.location ? `LOCATION:${esc(ev.location)}` : '',
    ev.description ? `DESCRIPTION:${esc(ev.description).slice(0, 900)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export async function shareOrCopy(data: { title: string; text?: string; url?: string }) {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  await copyText([data.text, data.url].filter(Boolean).join(' '));
  return 'copied';
}
