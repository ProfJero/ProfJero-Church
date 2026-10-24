import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { config, firebaseConfig } from '@/config';

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function supportsIndexedDb() {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

if (config.isConfigured) {
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Persistent cache makes the app usable offline and keeps data costs low on mobile networks.
  db = initializeFirestore(app, {
    localCache: supportsIndexedDb() && !config.useEmulators
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
    ignoreUndefinedProperties: true,
  });
  if (config.useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

export { app, auth, db };
