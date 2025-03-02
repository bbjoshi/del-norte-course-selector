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

  const checkAdminStatus = async (user: User) => {
    try {
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
    console.log(`Signing up user with email: ${email}`);
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`User created successfully with UID: ${user.uid}`);
    
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
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    console.log('Initiating Google sign-in');
    const provider = new GoogleAuthProvider();
    const { user } = await signInWithPopup(auth, provider);
    console.log(`Google sign-in successful for user: ${user.uid}`);
    
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
  };

  const logout = () => signOut(auth);

  useEffect(() => {
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
      {!loading && children}
    </AuthContext.Provider>
  );
};
