import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api, getAuthToken, setAuthToken } from '../api/client';
import type { UserResponse } from '../api/client';

interface AuthContextType {
  user: UserResponse | null;
  authEnabled: boolean;
  requiresSetup: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasRedirectedRef = useRef(false);

  const checkAuthStatus = async () => {
    try {
      const status = await api.getAuthStatus();
      setAuthEnabled(status.auth_enabled);
      setRequiresSetup(status.requires_setup);

      if (status.auth_enabled) {
        const token = getAuthToken();
        if (token) {
          try {
            const currentUser = await api.getCurrentUser();
            setUser(currentUser);
          } catch {
            // Token invalid, clear it
            setAuthToken(null);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } else {
        // Auth not enabled, allow access
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthEnabled(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check auth status on mount
    checkAuthStatus();
  }, []);

  // Separate effect to handle redirect only when setup is required
  useEffect(() => {
    // Only redirect if setup is truly required (first time setup)
    // Don't redirect if user manually navigated to /setup or is on camera page
    if (!loading && requiresSetup && !authEnabled) {
      const currentPath = window.location.pathname;
      // Only redirect if not already on setup page or camera page, and haven't redirected yet
      if (currentPath !== '/setup' && !currentPath.startsWith('/camera/') && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        window.location.href = '/setup';
      }
    } else if (!requiresSetup) {
      // Reset redirect flag when setup is no longer required
      hasRedirectedRef.current = false;
    }
  }, [loading, requiresSetup, authEnabled]);

  const login = async (username: string, password: string) => {
    const response = await api.login({ username, password });
    setAuthToken(response.access_token);
    setUser(response.user);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    api.logout().catch(() => {
      // Ignore logout errors
    });
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    if (authEnabled && getAuthToken()) {
      try {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
      } catch {
        setAuthToken(null);
        setUser(null);
      }
    }
  };

  const refreshAuth = async () => {
    await checkAuthStatus();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authEnabled,
        requiresSetup,
        loading,
        login,
        logout,
        refreshUser,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
