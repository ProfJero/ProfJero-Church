import { useSyncExternalStore } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Query,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from './firebase';

/* ------------------------------------------------------------------ */
/* Shared live subscriptions                                           */
/* One Firestore listener per key, shared by every component using it, */
/* kept warm briefly after the last subscriber leaves so navigating    */
/* back and forth doesn't re-read documents.                           */
/* ------------------------------------------------------------------ */

export interface LiveState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

interface Entry {
  state: LiveState<unknown>;
  listeners: Set<() => void>;
  unsub?: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

const registry = new Map<string, Entry>();
const KEEP_WARM_MS = 60_000;

function subscribeEntry(key: string, start: (set: (s: LiveState<unknown>) => void) => () => void, initial: unknown) {
  let entry = registry.get(key);
  if (!entry) {
    entry = { state: { data: initial, loading: true, error: null }, listeners: new Set() };
    registry.set(key, entry);
  }
  return (listener: () => void) => {
    const e = registry.get(key)!;
    clearTimeout(e.timer);
    e.listeners.add(listener);
    if (!e.unsub) {
      e.unsub = start((s) => {
        e.state = s;
        e.listeners.forEach((l) => l());
      });
    }
    return () => {
      e.listeners.delete(listener);
      if (e.listeners.size === 0) {
        e.timer = setTimeout(() => {
          e.unsub?.();
          e.unsub = undefined;
          registry.delete(key);
        }, KEEP_WARM_MS);
      }
    };
  };
}

const EMPTY: LiveState<never[]> = { data: [], loading: false, error: null };
const NULL_DOC: LiveState<null> = { data: null, loading: false, error: null };
const subscribers = new Map<string, (l: () => void) => () => void>();

function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

/** Live list. Pass key = null to skip (e.g. while waiting on auth). */
export function useCollection<T>(key: string | null, build: () => Query): LiveState<T[]> {
  const sub = key ? getSubscriber(key, () => buildListStart<T>(build), []) : noop;
  return useSyncExternalStore(sub, () => (key ? (registry.get(key)?.state as LiveState<T[]>) ?? LOADING_LIST : EMPTY));
}

/** Live single document. */
export function useDocument<T>(path: string | null): LiveState<T | null> {
  const key = path ? 'doc:' + path : null;
  const sub = key ? getSubscriber(key, () => buildDocStart<T>(path!), null) : noop;
  return useSyncExternalStore(sub, () => (key ? (registry.get(key)?.state as LiveState<T | null>) ?? LOADING_DOC : NULL_DOC));
}

const LOADING_LIST: LiveState<never[]> = { data: [], loading: true, error: null };
const LOADING_DOC: LiveState<null> = { data: null, loading: true, error: null };
const noop = () => () => {};

function getSubscriber(key: string, makeStart: () => (set: (s: LiveState<unknown>) => void) => () => void, initial: unknown) {
  let s = subscribers.get(key);
  if (!s) {
    s = subscribeEntry(key, makeStart(), initial);
    subscribers.set(key, s);
  }
  // registry entries may be evicted; re-create the subscriber if so
  if (!registry.has(key)) {
    s = subscribeEntry(key, makeStart(), initial);
    subscribers.set(key, s);
  }
  return s;
}

const RETRY_DELAYS = [1500, 4000, 10000];
const RETRYABLE = new Set(['permission-denied', 'unavailable', 'unauthenticated', 'deadline-exceeded', 'resource-exhausted']);

/**
 * Wraps a Firestore listener so transient failures (a role or profile that is
 * still propagating right after sign-up, a dropped connection) retry with
 * backoff instead of leaving the screen stuck until a reload.
 */
function resilient(listen: (onError: (e: Error) => void) => () => void, set: (s: LiveState<unknown>) => void, empty: unknown, label: string) {
  let unsub: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let stopped = false;
  const start = () => {
    unsub = listen((error) => {
      const code = (error as { code?: string }).code ?? '';
      if (!stopped && RETRYABLE.has(code) && attempt < RETRY_DELAYS.length) {
        timer = setTimeout(start, RETRY_DELAYS[attempt++]);
        return;
      }
      console.error('[cwc] listener failed', label, error);
      set({ data: empty, loading: false, error });
    });
  };
  start();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsub?.();
  };
}

function buildListStart<T>(build: () => Query) {
  return (set: (s: LiveState<unknown>) => void) =>
    resilient(
      (onError) =>
        onSnapshot(build(), (snap) => set({ data: snap.docs.map((d) => withId<T>(d.id, d.data())), loading: false, error: null }), onError),
      set,
      [],
      'query',
    );
}

function buildDocStart<T>(path: string) {
  return (set: (s: LiveState<unknown>) => void) =>
    resilient(
      (onError) =>
        onSnapshot(
          doc(db, path),
          { includeMetadataChanges: true },
          (snap) => {
            // Don't show "not found" for a document we simply haven't fetched yet.
            if (!snap.exists() && snap.metadata.fromCache) return;
            set({ data: snap.exists() ? withId<T>(snap.id, snap.data()) : null, loading: false, error: null });
          },
          onError,
        ),
      set,
      null,
      path,
    );
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export interface Actor {
  uid: string;
  name: string;
}

let actor: Actor | null = null;
export function setActor(a: Actor | null) {
  actor = a;
}
export function getActor() {
  return actor;
}

type Data = Record<string, unknown>;

function clean<T extends Data>(data: T): T {
  const out: Data = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && k !== 'id') out[k] = v;
  }
  return out as T;
}

export async function createDoc(col: string, data: Data, opts: { id?: string; audit?: string } = {}) {
  const payload = { ...clean(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: actor?.uid ?? null };
  let ref: DocumentReference;
  if (opts.id) {
    ref = doc(db, col, opts.id);
    await setDoc(ref, payload);
  } else {
    ref = await addDoc(collection(db, col), payload);
  }
  if (opts.audit) void audit('create', col, ref.id, opts.audit);
  return ref.id;
}

export async function patchDoc(col: string, id: string, data: Data, opts: { audit?: string } = {}) {
  await updateDoc(doc(db, col, id), { ...clean(data), updatedAt: serverTimestamp() });
  if (opts.audit) void audit('update', col, id, opts.audit);
}

export async function upsertDoc(col: string, id: string, data: Data, opts: { audit?: string } = {}) {
  await setDoc(doc(db, col, id), { ...clean(data), updatedAt: serverTimestamp() }, { merge: true });
  if (opts.audit) void audit('update', col, id, opts.audit);
}

export async function removeDoc(col: string, id: string, opts: { audit?: string } = {}) {
  await deleteDoc(doc(db, col, id));
  if (opts.audit) void audit('delete', col, id, opts.audit);
}

/** Batched create — Firestore caps a batch at 500 writes, so chunk. */
export async function createMany(col: string, rows: Data[], onProgress?: (done: number) => void) {
  let done = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + 400)) {
      batch.set(doc(collection(db, col)), {
        ...clean(row),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: actor?.uid ?? null,
      });
    }
    await batch.commit();
    done += Math.min(400, rows.length - i);
    onProgress?.(done);
  }
}

export async function audit(action: string, entity: string, entityId: string | undefined, summary: string) {
  if (!actor) return;
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action,
      entity,
      entityId: entityId ?? null,
      summary,
      by: actor.uid,
      byName: actor.name,
      at: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[cwc] audit failed', e);
  }
}

export { db, serverTimestamp };
