import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { mockFirestore } from './mockFirestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWecUxj14oE5TLqAi8NApBnz97Z9mxJPo",
  authDomain: "del-norte-course-selecto-bcb4c.firebaseapp.com",
  projectId: "del-norte-course-selecto-bcb4c",
  storageBucket: "del-norte-course-selecto-bcb4c.firebasestorage.app",
  messagingSenderId: "1032248739611",
  appId: "1:1032248739611:web:1d982f2c31206a68d9f5be"
};

console.log("Initializing Firebase with config:", JSON.stringify(firebaseConfig));

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);

// Initialize Firestore with fallback to mock implementation
let db: any;

try {
  console.log("Initializing Firestore...");
  db = getFirestore(app);
  
  // Check if we're in development mode to use emulator
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
    console.log("Connecting to Firestore emulator...");
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
  
  // Test if Firestore is actually available
  const testId = db._delegate._databaseId;
  console.log("Firestore initialized successfully with database ID:", testId);
} catch (error) {
  console.error("Error initializing Firestore:", error);
  console.log("Using mock Firestore implementation instead");
  db = mockFirestore;
}

export { db };
