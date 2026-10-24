/** Opens a clean, printable document (statements, receipts, reports). Users can "Save as PDF". */
export function printDocument(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'noopener=no,width=900,height=1000');
  if (!w) {
    alert('Please allow pop-ups to print.');
    return;
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box} body{font:14px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#18181b;margin:40px;}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:28px 0 8px} .muted{color:#71717a}
  table{width:100%;border-collapse:collapse;margin-top:8px} th,td{padding:8px 6px;border-bottom:1px solid #e4e4e7;text-align:left}
  th{font-size:12px;color:#71717a;font-weight:600} td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e3a8a;padding-bottom:16px;margin-bottom:20px}
  .total td{font-weight:700;border-top:2px solid #18181b} .foot{margin-top:40px;font-size:11px;color:#a1a1aa;display:flex;justify-content:space-between}
  @media print{body{margin:16mm} .noprint{display:none}}
</style></head><body>${bodyHtml}
<div class="foot"><span>Generated ${new Date().toLocaleString('en-GH')}</span><span>Crafted by ProfJero</span></div>
<script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

export function escapeHtml(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
