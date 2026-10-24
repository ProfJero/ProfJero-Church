// Local stand-in for ProfJero Connect, for development and end-to-end tests.
// Mirrors the documented request/response shapes. Run: node scripts/mock-profjero.mjs
import http from 'node:http';

const PORT = Number(process.env.PORT || 8790);
let units = 1000;
const batches = new Map();
const idem = new Map();
const pages = (m) => { const gsm = !/[^\x00-\x7F£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¡ÄÖÑÜ§¿äöñüà€]/.test(m); const per = gsm ? (m.length > 160 ? 153 : 160) : m.length > 70 ? 67 : 70; return Math.max(1, Math.ceil(m.length / per)); };
const render = (m, f = {}) => m.replace(/\{([a-z_]+)(?:\|([^}]*))?\}/gi, (_, k, fb) => f[k] || fb || '');

const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const err = (res, status, message) => send(res, status, { error: { code: `http_${status}`, message, requestId: crypto.randomUUID() } });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : {};
  if (url.pathname === '/v1/pricing') return send(res, 200, { unitPriceGhs: 0.04, currency: 'GHS', packages: [{ id: 'starter', name: 'Starter', units: 500, amountGhs: 20 }, { id: 'church', name: 'Church', units: 3000, amountGhs: 110 }] });
  if (req.headers.authorization !== 'Bearer pk_live_test') return err(res, 401, 'Missing, invalid, revoked or expired API key.');
  const p = url.pathname;
  if (p === '/v1/balance') return send(res, 200, { availableUnits: units, lowBalance: units < 100, updatedAt: new Date().toISOString() });
  if (p === '/v1/wallet') return send(res, 200, { availableUnits: units, reservedUnits: 0, totalUnits: units, lowBalanceThreshold: 100, updatedAt: new Date().toISOString() });
  if (p === '/v1/wallet/transactions') return send(res, 200, { transactions: [{ id: 't1', type: 'topup', delta: 1000, description: 'Top-up (starter)', createdAt: new Date().toISOString() }], nextCursor: null });
  if (p === '/v1/sender-ids') return send(res, 200, { senderIds: [{ senderId: 'CWC', status: 'approved', purpose: 'Church notifications' }], count: 1 });
  if (p === '/v1/payments' && req.method === 'GET') return send(res, 200, { payments: [], totals: {} });
  if (p === '/v1/payments' && req.method === 'POST') return send(res, 201, { payment: { reference: 'pja_test', units: 500, amountGhs: 20, status: 'pending', paidAt: null }, checkoutUrl: 'https://checkout.example/pja_test' });
  if (p === '/v1/sms/estimate' || p === '/v1/sms/send') {
    const recips = (json.recipients || []).map((r) => (typeof r === 'string' ? { phone: r } : r));
    const msgs = recips.map((r) => render(json.message, r.fields));
    const need = msgs.reduce((n, m) => n + pages(m), 0);
    if (p === '/v1/sms/estimate') return send(res, 200, { recipients: recips.length, units: need, availableUnits: units, sufficient: need <= units, personalized: recips.some((r) => r.fields), samples: msgs.slice(0, 3).map((m, i) => ({ phone: recips[i].phone, message: m, segments: pages(m) })) });
    const key = req.headers['idempotency-key'];
    if (!key) return err(res, 400, 'Idempotency-Key header is required');
    if (idem.has(key)) return send(res, 200, idem.get(key));
    if (!json.senderId) return err(res, 400, 'senderId is required');
    if (need > units) return err(res, 402, 'Insufficient units. Top up your wallet (POST /v1/payments) and retry.');
    if (json.scheduleAt) { const out = { scheduled: true, campaign: { id: 'auto' + Math.floor(Math.random() * 1e6), status: 'scheduled', nextRunAt: json.scheduleAt, estimate: { recipients: recips.length, units: need } } }; idem.set(key, out); return send(res, 201, out); }
    units -= need;
    const batch = { id: key, status: 'completed', senderId: json.senderId, message: json.message, personalized: recips.some((r) => r.fields), totalRecipients: recips.length, totalUnitsReserved: need, totalUnitsCharged: need, submittedCount: recips.length, failedCount: 0, unknownCount: 0, deliveredCount: recips.length, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
    const records = recips.map((r, i) => ({ id: `${key}__r${i}`, recipient: r.phone, message: msgs[i], unitsPerMessage: pages(msgs[i]), status: 'delivered' }));
    const out = { batch, records };
    batches.set(key, out);
    idem.set(key, out);
    console.log(`[mock-profjero] sent ${recips.length} SMS from ${json.senderId}: ${msgs[0]}`);
    return send(res, 201, out);
  }
  const b = p.match(/^\/v1\/sms\/batches\/(.+)$/);
  if (b) return batches.has(b[1]) ? send(res, 200, batches.get(b[1])) : err(res, 404, 'Not found');
  if (p === '/v1/campaigns') return send(res, 200, { campaigns: [] });
  if (/^\/v1\/campaigns\/.+\/cancel$/.test(p)) return send(res, 200, { campaign: { status: 'cancelled' } });
  err(res, 404, 'Not found');
}).listen(PORT, () => console.log(`[mock-profjero] listening on http://127.0.0.1:${PORT}`));
