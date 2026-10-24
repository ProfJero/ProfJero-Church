import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { setActor } from './db';
import { can as roleCan, isStaff, type Permission } from './permissions';
import { normalizePhone, isValidPhone } from './phone';
import type { Role, UserProfile } from './types';

/**
 * Members may sign up with just a phone number. Those accounts use a synthetic
 * login email derived from the number; it is never shown or emailed.
 */
export const PHONE_LOGIN_DOMAIN = 'phone.cwc.app';

export function loginEmailFor(identifier: string) {
  const v = identifier.trim();
  if (v.includes('@')) return v.toLowerCase();
  if (isValidPhone(v)) return `${normalizePhone(v)}@${PHONE_LOGIN_DOMAIN}`;
  return v.toLowerCase();
}

export function isPhoneLogin(email?: string | null) {
  return !!email && email.endsWith('@' + PHONE_LOGIN_DOMAIN);
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  staff: boolean;
  can: (p: Permission) => boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  staff: false,
  can: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    let unsubProfile: (() => void) | undefined;
    const unsub = onAuthStateChanged(auth, (u) => {
      unsubProfile?.();
      setUser(u);
      if (!u) {
        setProfile(null);
        setActor(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        { includeMetadataChanges: true },
        (snap) => {
          // A cache-only "missing" (slow or no connection on first sign-in) isn't an answer — wait for the server.
          if (!snap.exists() && snap.metadata.fromCache) return;
          const p = snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null;
          setProfile(p);
          setActor(p ? { uid: u.uid, name: p.fullName || u.email || 'User' } : null);
          setLoading(false);
        },
        (err) => {
          console.error('[cwc] profile load failed', err);
          setProfile(null);
          setLoading(false);
        },
      );
    });
    return () => {
      unsub();
      unsubProfile?.();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    const active = profile?.isActive !== false;
    const role = active ? profile?.role ?? null : null;
    return {
      user,
      profile,
      role,
      loading,
      staff: isStaff(role),
      can: (p) => roleCan(role, p),
    };
  }, [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function signIn(identifier: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, loginEmailFor(identifier), password);
  // Best-effort; rules allow a user to touch only their own lastLogin.
  updateDoc(doc(db, 'users', cred.user.uid), { lastLogin: serverTimestamp() }).catch(() => {});
  return cred.user;
}

export interface SignUpInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
}

export async function signUp(input: SignUpInput) {
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : `${phone}@${PHONE_LOGIN_DOMAIN}`;
  const cred = await createUserWithEmailAndPassword(auth, email, input.password);
  await updateProfile(cred.user, { displayName: input.fullName }).catch(() => {});
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email: input.email?.trim().toLowerCase() || '',
    fullName: input.fullName.trim(),
    phone,
    role: 'member',
    isActive: true,
    memberId: null,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
  });
  return cred.user;
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOut() {
  await fbSignOut(auth);
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email/phone and password don’t match. Please try again.';
    case 'auth/invalid-email':
      return 'Enter a valid email address or Ghana phone number.';
    case 'auth/email-already-in-use':
      return 'An account already exists with these details. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 6 characters).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'You appear to be offline. Check your connection and retry.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the church office.';
    default:
      return (err as Error)?.message || 'Something went wrong. Please try again.';
  }
}
