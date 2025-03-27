import { initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';

// Use environment variables for Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

console.log("Firebase Config:", {
  apiKey: firebaseConfig.apiKey ? "Set" : "Not set",
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket ? "Set" : "Not set",
  messagingSenderId: firebaseConfig.messagingSenderId ? "Set" : "Not set",
  appId: firebaseConfig.appId ? "Set" : "Not set"
});

// Check if required config values are present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase configuration is incomplete. Missing required fields.");
}

// Declare variables for export with proper types
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  console.log("Firebase app initialized successfully");

  // Initialize Auth
  auth = getAuth(app);
  console.log("Firebase Auth initialized successfully");

  // Initialize Firestore with error handling
  try {
    db = getFirestore(app);
    console.log("Firestore initialized successfully");

    // Connect to Firestore emulator if enabled
    if (process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
      try {
        console.log("Connecting to Firestore emulator");
        if (db) {
          connectFirestoreEmulator(db, 'localhost', 8080);
          console.log("Connected to Firestore emulator successfully");
        }
      } catch (emulatorError) {
        console.error("Failed to connect to Firestore emulator:", emulatorError);
      }
    }
  } catch (firestoreError) {
    console.error("Failed to initialize Firestore:", firestoreError);
    // db remains null
  }
} catch (firebaseError) {
  console.error("Failed to initialize Firebase:", firebaseError);
  // auth and db remain null
}

// Export the variables
export { auth, db };
