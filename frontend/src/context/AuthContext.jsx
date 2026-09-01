import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginApi, registerApi, getMeApi } from '../services/api.js';

const AuthContext = createContext(null);

const safeGetToken = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('documind_token') : null;
  } catch (e) {
    return null;
  }
};

const safeSetToken = (token) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('documind_token', token);
    }
  } catch (e) {}
};

const safeRemoveToken = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('documind_token');
    }
  } catch (e) {}
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(safeGetToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore authenticated session on mount if token exists
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = safeGetToken();
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await getMeApi();
        if (res.success && res.user) {
          setUser(res.user);
          setToken(savedToken);
        } else {
          safeRemoveToken();
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        safeRemoveToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Listen for global 401 unauthorized events from Axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      safeRemoveToken();
    };

    window.addEventListener('documind_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('documind_unauthorized', handleUnauthorized);
  }, []);

  const login = async ({ email, password }) => {
    setError(null);
    try {
      const res = await loginApi({ email, password });
      if (res.success && res.token && res.user) {
        safeSetToken(res.token);
        setToken(res.token);
        setUser(res.user);
        return res.user;
      } else {
        throw new Error(res.error || 'Login failed.');
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Invalid email or password.';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async ({ name, email, password }) => {
    setError(null);
    try {
      const res = await registerApi({ name, email, password });
      if (res.success && res.token && res.user) {
        safeSetToken(res.token);
        setToken(res.token);
        setUser(res.user);
        return res.user;
      } else {
        throw new Error(res.error || 'Registration failed.');
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Registration failed.';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = useCallback(() => {
    safeRemoveToken();
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
