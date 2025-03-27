import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Use environment variables for Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

console.log("Initializing Firebase with config:", {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase app initialized successfully");

// Initialize Auth
export const auth = getAuth(app);
console.log("Firebase Auth initialized successfully");

// Initialize Firestore
export const db = getFirestore(app);
console.log("Firestore initialized successfully");

// Connect to Firestore emulator if enabled
if (process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  console.log("Connecting to Firestore emulator");
  connectFirestoreEmulator(db, 'localhost', 8080);
}
