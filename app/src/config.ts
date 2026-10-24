const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const config = {
  apiUrl: ((env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, ''),
  cloudinaryCloudName: (env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined) ?? '',
  cloudinaryUploadPreset: (env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined) ?? '',
  useEmulators: env.VITE_USE_EMULATORS === 'true',
  isConfigured: Boolean(firebaseConfig.apiKey && firebaseConfig.projectId),
};

/** Defaults shown until the church profile is saved in Settings. */
export const CHURCH_DEFAULTS = {
  name: 'Christian Worship Centre',
  shortName: 'CWC',
  tagline: 'Worship • Word • World',
  currency: 'GHS',
  timezone: 'Africa/Accra',
  country: 'GH',
};

export const SIGNATURE = {
  name: 'ProfJero',
  tagline: 'Building Solutions. Empowering Lives.',
};
