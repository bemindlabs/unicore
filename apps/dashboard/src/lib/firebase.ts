import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyBfBA087UEB9YtlgjG0FqkEH6WLYZlOpc4',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'unicore-2ec52.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'unicore-2ec52',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'unicore-2ec52.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '854494512819',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:854494512819:web:04c052e1a635c75b1152c6',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? 'G-WB0QK5V1J5',
};

export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const GA_MEASUREMENT_ID = firebaseConfig.measurementId;
