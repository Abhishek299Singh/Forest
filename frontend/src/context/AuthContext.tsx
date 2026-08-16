import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { ApiClient } from '../api/client';
import { auth, signInWithEmailAndPassword, signOut as fbSignOut, getIdToken } from '../firebase/config';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const u = await ApiClient.getMe();
      setUser(u);
    } catch (err) {
      setUser(null);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const u = await ApiClient.getMe();
        setUser(u);
      } catch (err) {
        // In offline field deployment, default to admin if no session is stored
        const token = ApiClient.getToken();
        if (!token) {
          try {
            const res = await ApiClient.login({ email: 'admin@pench.gov.in', password: 'pench123' });
            ApiClient.setToken(res.access_token);
            setUser(res.user);
          } catch (_) {
            setUser(null);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      // 1. Try Firebase Authentication flow
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const idToken = await getIdToken(userCredential.user);
        // Exchange Firebase ID token with backend for role verification
        const res = await ApiClient.firebaseLogin(idToken);
        ApiClient.setToken(res.access_token);
        setUser(res.user);
        return;
      } catch (fbErr: any) {
        // If Firebase Auth project is unreachable or operating offline, fall back to backend local authentication
        console.warn('Firebase login unreachable/fallback to local auth:', fbErr.message);
      }

      // 2. Direct local backend authentication (Offline Field Mode)
      const res = await ApiClient.login({ email, password: pass });
      ApiClient.setToken(res.access_token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    try {
      fbSignOut(auth);
    } catch (_) {}
    ApiClient.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
