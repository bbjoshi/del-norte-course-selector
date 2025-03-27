import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  loading: boolean;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if Firebase services are available
  const isFirebaseAvailable = !!auth;

  if (!isFirebaseAvailable) {
    console.error('Firebase Auth is not available');
    setAuthError('Firebase authentication service is not available');
  }

  const checkAdminStatus = async (user: User) => {
    try {
      // Check if Firestore is available
      if (!db) {
        console.error('Firestore is not available, cannot check admin status');
        return false;
      }
      
      // Try to get user document from Firestore
      console.log(`Checking admin status for user: ${user.uid}`);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const isAdmin = userDoc.exists() && userDoc.data()?.role === 'admin';
      console.log(`User admin status: ${isAdmin}`);
      return isAdmin;
    } catch (error) {
      console.error('Error checking admin status:', error);
      // In case of Firestore error, default to non-admin
      return false;
    }
  };

  const signup = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not available');
    }
    
    console.log(`Signing up user with email: ${email}`);
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`User created successfully with UID: ${user.uid}`);
    
    if (db) {
      try {
        console.log(`Creating user document in Firestore for UID: ${user.uid}`);
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
        console.log('User document created successfully');
      } catch (error) {
        console.error('Error creating user document:', error);
        // Continue even if Firestore fails - authentication still works
      }
    } else {
      console.warn('Firestore not available, skipping user document creation');
    }
  };

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not available');
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error('Firebase authentication is not available');
    }
    
    console.log('Initiating Google sign-in');
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);
    console.log(`Google sign-in successful for user: ${user.uid}`);
    
    if (db) {
      try {
        console.log(`Checking if user document exists for UID: ${user.uid}`);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          console.log(`Creating new user document for Google user: ${user.uid}`);
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: 'user',
            createdAt: new Date().toISOString()
          });
          console.log('Google user document created successfully');
        } else {
          console.log('User document already exists for Google user');
        }
      } catch (error) {
        console.error('Error checking/creating user document:', error);
        // Continue even if Firestore fails - authentication still works
      }
    } else {
      console.warn('Firestore not available, skipping user document creation');
    }
  };

  const logout = async () => {
    if (!auth) {
      throw new Error('Firebase authentication is not available');
    }
    return signOut(auth);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return () => {};
    }
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setCurrentUser(user);
          try {
            const adminStatus = await checkAdminStatus(user);
            setIsAdmin(adminStatus);
          } catch (error) {
            console.error('Error checking admin status:', error);
            setIsAdmin(false);
          }
        } else {
          setCurrentUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        // Even if there's an error, set the current user if available
        // This ensures the app can function even with Firestore issues
        if (user) {
          setCurrentUser(user);
        }
        setIsAdmin(false);
      } finally {
        // Always set loading to false to allow the app to render
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin,
    loading,
    signup,
    login,
    logout,
    signInWithGoogle
  };

  return (
    <AuthContext.Provider value={value}>
      {authError ? (
        <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>
          <h2>Authentication Error</h2>
          <p>{authError}</p>
          <p>Please check your Firebase configuration and try again.</p>
        </div>
      ) : (
        !loading && children
      )}
    </AuthContext.Provider>
  );
};
