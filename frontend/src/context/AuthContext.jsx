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

  // Document-related application states to prevent cross-user leakage
  const [activeDocument, setActiveDocument] = useState(null);
  const [summary, setSummary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [documentList, setDocumentList] = useState([]);

  const purgeDocumentState = useCallback(() => {
    setActiveDocument(null);
    setSummary(null);
    setMessages([]);
    setDocumentList([]);
  }, []);

  const logout = useCallback(() => {
    // 1. Explicitly purge all document-related states to initial empty values (null / [])
    setActiveDocument(null);
    setSummary(null);
    setMessages([]);
    setDocumentList([]);

    // 2. Clear localStorage and sessionStorage completely
    try {
      if (typeof window !== 'undefined') {
        if (window.localStorage && typeof window.localStorage.clear === 'function') {
          window.localStorage.clear();
        }
        if (window.sessionStorage && typeof window.sessionStorage.clear === 'function') {
          window.sessionStorage.clear();
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Storage clear failed on logout:', e);
    }

    // 3. Clean up URL session parameters (?doc=..., ?documentId=..., ?chatId=...)
    try {
      if (typeof window !== 'undefined' && window.location) {
        const url = new URL(window.location.href);
        url.searchParams.delete('doc');
        url.searchParams.delete('documentId');
        url.searchParams.delete('chatId');
        window.history.replaceState({}, '', url.pathname);
      }
    } catch (e) {}

    // 4. Reset authentication state
    safeRemoveToken();
    setToken(null);
    setUser(null);
    setError(null);

    // 5. Broadcast global logout event to purge any hook/component-level caches
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('documind_logout'));
    }
  }, []);

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
          logout();
        }
      } catch (err) {
        logout();
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [logout]);

  // Listen for global 401 unauthorized events from Axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('documind_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('documind_unauthorized', handleUnauthorized);
  }, [logout]);

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

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        error,
        activeDocument,
        setActiveDocument,
        summary,
        setSummary,
        messages,
        setMessages,
        documentList,
        setDocumentList,
        purgeDocumentState,
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
