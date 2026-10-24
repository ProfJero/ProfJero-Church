import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, writeBatch, deleteDoc, increment } from 'firebase/firestore';

let env: RulesTestEnvironment;

const users: Record<string, { role: string; memberId?: string | null; isActive?: boolean }> = {
  sa: { role: 'super_admin' },
  admin: { role: 'admin' },
  pastor: { role: 'pastor' },
  treasurer: { role: 'treasurer' },
  secretary: { role: 'secretary' },
  usher: { role: 'staff' },
  ama: { role: 'member', memberId: 'm-ama' },
  kofi: { role: 'member', memberId: 'm-kofi' },
  gone: { role: 'admin', isActive: false },
};

const db = (id?: string) => (id ? env.authenticatedContext(id).firestore() : env.unauthenticatedContext().firestore());

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cwc-rules',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const [id, u] of Object.entries(users)) {
      await setDoc(doc(d, 'users', id), { uid: id, fullName: id, role: u.role, isActive: u.isActive ?? true, memberId: u.memberId ?? null });
    }
    await setDoc(doc(d, 'settings', 'bootstrap'), { at: 1 });
    await setDoc(doc(d, 'members', 'm-ama'), { fullName: 'Ama', uid: 'ama', phone: '233241111111' });
    await setDoc(doc(d, 'members', 'm-kofi'), { fullName: 'Kofi', uid: 'kofi', phone: '233242222222' });
    await setDoc(doc(d, 'gifts', 'g1'), { memberId: 'm-ama', amount: 100, date: '2026-10-01' });
    await setDoc(doc(d, 'gifts', 'g2'), { memberId: 'm-kofi', amount: 50, date: '2026-10-01' });
    await setDoc(doc(d, 'care_requests', 'c-private'), { uid: 'ama', type: 'counselling', visibility: 'private', status: 'new', responses: [] });
    await setDoc(doc(d, 'care_requests', 'c-public'), { uid: 'ama', type: 'prayer', visibility: 'public', status: 'new', responses: [], prayedCount: 0 });
    await setDoc(doc(d, 'events', 'e1'), { title: 'Conference', status: 'published', rsvpCount: 0 });
    await setDoc(doc(d, 'events', 'e-draft'), { title: 'Secret', status: 'draft' });
    await setDoc(doc(d, 'services', 's-open'), { isOpen: true });
    await setDoc(doc(d, 'services', 's-closed'), { isOpen: false });
  });
});

describe('users & roles', () => {
  it('lets a new person sign up only as a member', async () => {
    await assertSucceeds(setDoc(doc(db('new1'), 'users', 'new1'), { uid: 'new1', role: 'member', isActive: true, memberId: null }));
    await assertFails(setDoc(doc(db('new2'), 'users', 'new2'), { uid: 'new2', role: 'admin', isActive: true, memberId: null }));
    await assertFails(setDoc(doc(db('new3'), 'users', 'new3'), { uid: 'new3', role: 'member', isActive: true, memberId: 'm-kofi' }));
  });
  it('blocks members from promoting themselves', async () => {
    await assertFails(updateDoc(doc(db('ama'), 'users', 'ama'), { role: 'super_admin' }));
    await assertFails(updateDoc(doc(db('ama'), 'users', 'ama'), { memberId: 'm-kofi' }));
    await assertSucceeds(updateDoc(doc(db('ama'), 'users', 'ama'), { fullName: 'Ama Mensah' }));
  });
  it('lets admins manage roles but not create super admins', async () => {
    await assertSucceeds(updateDoc(doc(db('admin'), 'users', 'ama'), { role: 'secretary' }));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'kofi'), { role: 'super_admin' }));
    await assertFails(updateDoc(doc(db('admin'), 'users', 'sa'), { role: 'member' }));
    await assertSucceeds(updateDoc(doc(db('sa'), 'users', 'kofi'), { role: 'super_admin' }));
  });
  it('treats deactivated staff as having no role', async () => {
    await assertFails(getDocs(collection(db('gone'), 'members')));
  });
  it('allows first-run bootstrap exactly once', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'settings', 'bootstrap')));
    const f = db('founder');
    const b = writeBatch(f);
    b.set(doc(f, 'users', 'founder'), { uid: 'founder', role: 'super_admin', isActive: true });
    b.set(doc(f, 'settings', 'bootstrap'), { at: 1 });
    await assertSucceeds(b.commit());
    const x = db('intruder');
    const b2 = writeBatch(x);
    b2.set(doc(x, 'users', 'intruder'), { uid: 'intruder', role: 'super_admin', isActive: true });
    b2.set(doc(x, 'settings', 'bootstrap'), { at: 2 });
    await assertFails(b2.commit());
  });
});

describe('people', () => {
  it('members read only their own record', async () => {
    await assertSucceeds(getDoc(doc(db('ama'), 'members', 'm-ama')));
    await assertFails(getDoc(doc(db('ama'), 'members', 'm-kofi')));
    await assertFails(getDocs(collection(db('ama'), 'members')));
  });
  it('members may edit contact details but not membership fields', async () => {
    await assertSucceeds(updateDoc(doc(db('ama'), 'members', 'm-ama'), { phone: '233243333333' }));
    await assertFails(updateDoc(doc(db('ama'), 'members', 'm-ama'), { membershipStatus: 'leader' }));
  });
  it('staff can list, secretaries can edit, ushers cannot', async () => {
    await assertSucceeds(getDocs(collection(db('usher'), 'members')));
    await assertSucceeds(updateDoc(doc(db('secretary'), 'members', 'm-kofi'), { membershipStatus: 'worker' }));
    await assertFails(updateDoc(doc(db('usher'), 'members', 'm-kofi'), { membershipStatus: 'worker' }));
  });
  it('anonymous visitors see nothing', async () => {
    await assertFails(getDoc(doc(db(), 'members', 'm-ama')));
    await assertSucceeds(getDoc(doc(db(), 'settings', 'church')));
  });
});

describe('giving', () => {
  it('members see only their own giving', async () => {
    await assertSucceeds(getDocs(query(collection(db('ama'), 'gifts'), where('memberId', '==', 'm-ama'))));
    await assertFails(getDocs(query(collection(db('ama'), 'gifts'), where('memberId', '==', 'm-kofi'))));
    await assertFails(getDocs(collection(db('ama'), 'gifts')));
  });
  it('only finance roles record gifts; secretaries cannot read them', async () => {
    await assertSucceeds(setDoc(doc(db('treasurer'), 'gifts', 'g3'), { amount: 20, memberId: null, date: '2026-10-02' }));
    await assertFails(setDoc(doc(db('pastor'), 'gifts', 'g4'), { amount: 20 }));
    await assertFails(getDocs(collection(db('secretary'), 'gifts')));
  });
});

describe('pastoral care', () => {
  it('keeps counselling private to the requester and pastors', async () => {
    await assertSucceeds(getDoc(doc(db('ama'), 'care_requests', 'c-private')));
    await assertSucceeds(getDoc(doc(db('pastor'), 'care_requests', 'c-private')));
    await assertFails(getDoc(doc(db('kofi'), 'care_requests', 'c-private')));
    await assertFails(getDoc(doc(db('secretary'), 'care_requests', 'c-private')));
  });
  it('shows public prayers on the wall and allows "I prayed"', async () => {
    await assertSucceeds(getDocs(query(collection(db('kofi'), 'care_requests'), where('visibility', '==', 'public'), where('type', '==', 'prayer'))));
    await assertSucceeds(updateDoc(doc(db('kofi'), 'care_requests', 'c-public'), { prayedCount: 1 }));
    await assertFails(updateDoc(doc(db('kofi'), 'care_requests', 'c-public'), { prayedCount: 50 }));
    await assertFails(updateDoc(doc(db('kofi'), 'care_requests', 'c-public'), { status: 'closed' }));
  });
  it('requests are created as new and unassigned', async () => {
    await assertSucceeds(setDoc(doc(db('kofi'), 'care_requests', 'c-new'), { uid: 'kofi', type: 'prayer', visibility: 'private', status: 'new', responses: [] }));
    await assertFails(setDoc(doc(db('kofi'), 'care_requests', 'c-bad'), { uid: 'ama', type: 'prayer', visibility: 'private', status: 'new', responses: [] }));
    await assertFails(setDoc(doc(db('kofi'), 'care_requests', 'c-bad2'), { uid: 'kofi', type: 'prayer', status: 'completed', responses: [] }));
  });
});

describe('events & attendance', () => {
  it('hides drafts from members', async () => {
    await assertSucceeds(getDoc(doc(db('ama'), 'events', 'e1')));
    await assertFails(getDoc(doc(db('ama'), 'events', 'e-draft')));
  });
  it('ties the RSVP counter to the member’s own RSVP', async () => {
    const d = db('ama');
    const b = writeBatch(d);
    b.set(doc(d, 'events', 'e1', 'rsvps', 'ama'), { uid: 'ama', name: 'Ama', guests: 0 });
    b.update(doc(d, 'events', 'e1'), { rsvpCount: increment(1) });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(d, 'events', 'e1'), { rsvpCount: increment(1) }));
    await assertFails(updateDoc(doc(d, 'events', 'e1'), { title: 'Hacked' }));
  });
  it('allows QR self check-in only to open services, once', async () => {
    const d = db('ama');
    await assertSucceeds(setDoc(doc(d, 'attendance', 's-open_m-ama'), { serviceId: 's-open', memberId: 'm-ama', method: 'self' }));
    await assertFails(setDoc(doc(d, 'attendance', 's-closed_m-ama'), { serviceId: 's-closed', memberId: 'm-ama', method: 'self' }));
    await assertFails(setDoc(doc(d, 'attendance', 's-open_m-kofi'), { serviceId: 's-open', memberId: 'm-kofi', method: 'self' }));
    // members can see whether they are checked in, but not other people's records
    await assertSucceeds(getDoc(doc(d, 'attendance', 's-closed_m-ama')));
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'attendance', 's-open_m-kofi'), { serviceId: 's-open', memberId: 'm-kofi', method: 'manual' }));
    await assertFails(getDoc(doc(d, 'attendance', 's-open_m-kofi')));
  });
});

describe('messaging & audit', () => {
  it('limits SMS history to messaging roles', async () => {
    await assertSucceeds(getDocs(collection(db('secretary'), 'sms_messages')));
    await assertFails(getDocs(collection(db('treasurer'), 'sms_messages')));
    await assertFails(getDocs(collection(db('ama'), 'sms_messages')));
  });
  it('shows members broadcast and personal notifications only', async () => {
    await assertSucceeds(getDocs(query(collection(db('ama'), 'notifications'), where('audience', 'in', ['all', 'ama']))));
    await assertFails(getDocs(query(collection(db('ama'), 'notifications'), where('audience', '==', 'kofi'))));
  });
  it('makes the audit log append-only', async () => {
    await assertSucceeds(setDoc(doc(db('secretary'), 'audit_logs', 'a1'), { by: 'secretary', action: 'x' }));
    await assertFails(setDoc(doc(db('secretary'), 'audit_logs', 'a2'), { by: 'admin', action: 'x' }));
    await assertFails(updateDoc(doc(db('sa'), 'audit_logs', 'a1'), { action: 'y' }));
  });
});
