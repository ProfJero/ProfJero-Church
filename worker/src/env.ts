export interface Env {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string;
  PROFJERO_BASE_URL: string;
  PROFJERO_API_KEY?: string;
  PROFJERO_SENDER_ID?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  FIREBASE_SERVICE_ACCOUNT?: string;
  EMULATOR?: string;
  FIRESTORE_EMULATOR_URL?: string;
}
