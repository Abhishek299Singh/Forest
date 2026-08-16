import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  getIdToken,
  User as FirebaseUser
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyPenchTigerReserve2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pench-wildlife-platform.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pench-wildlife-platform",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pench-wildlife-platform.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "102938475610",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:102938475610:web:8a7b6c5d4e3f2a1b"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  getIdToken 
};
export type { FirebaseUser };
