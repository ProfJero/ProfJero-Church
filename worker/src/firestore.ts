import type { Env } from './env';

/** Minimal Firestore REST client. Calls run with the caller's ID token, so security rules apply. */
export type Doc = Record<string, unknown> & { __id?: string; __name?: string };

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FsValue> } }
  | { arrayValue: { values?: FsValue[] } }
  | { referenceValue: string };

export function base(env: Env) {
  const host = env.EMULATOR === 'true' ? env.FIRESTORE_EMULATOR_URL || 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com';
  return `${host}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

export function decodeValue(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  return undefined;
}

export function decodeFields(fields: Record<string, FsValue>): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, encodeValue(x)])) } };
}

function docFrom(raw: { name: string; fields?: Record<string, FsValue> }): Doc {
  const d = decodeFields(raw.fields ?? {});
  d.__name = raw.name;
  d.__id = raw.name.split('/').pop();
  return d;
}

export async function getDocument(env: Env, path: string, token: string): Promise<Doc | null> {
  const res = await fetch(`${base(env)}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore get ${path} failed: ${res.status}`);
  return docFrom(await res.json());
}

export async function listDocuments(env: Env, collection: string, token: string, pageSize: number, pageToken?: string) {
  const url = new URL(`${base(env)}/${collection}`);
  url.searchParams.set('pageSize', String(pageSize));
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Firestore list ${collection} failed: ${res.status}`);
  const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string };
  return { docs: (body.documents ?? []).map(docFrom), nextPageToken: body.nextPageToken };
}

/** Structured query with simple equality / IN filters. */
export async function runQuery(env: Env, collection: string, token: string, filters: { field: string; op: 'EQUAL' | 'IN'; value: unknown }[], limit = 500): Promise<Doc[]> {
  const where =
    filters.length === 0
      ? undefined
      : filters.length === 1
        ? { fieldFilter: { field: { fieldPath: filters[0].field }, op: filters[0].op, value: encodeValue(filters[0].value) } }
        : { compositeFilter: { op: 'AND', filters: filters.map((f) => ({ fieldFilter: { field: { fieldPath: f.field }, op: f.op, value: encodeValue(f.value) } })) } };
  const res = await fetch(`${base(env)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where, limit } }),
  });
  if (!res.ok) throw new Error(`Firestore query ${collection} failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
  return rows.filter((r) => r.document).map((r) => docFrom(r.document!));
}

export async function deleteDocument(env: Env, path: string, token: string) {
  await fetch(`${base(env)}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
}

export async function createDocument(env: Env, collection: string, token: string, data: Record<string, unknown>) {
  const res = await fetch(`${base(env)}/${collection}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encodeValue(v)])) }),
  });
  if (!res.ok) throw new Error(`Firestore create in ${collection} failed: ${res.status}`);
}
