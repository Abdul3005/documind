import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-DocuMind-Client': 'web-app',
  },
  withCredentials: true,
  timeout: 30000,
});

// Mutex / Queue state for handling simultaneous 401 refresh requests safely
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: attach JWT Bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('documind_token') : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {}
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: handle silent token refresh on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Never attempt to refresh auth endpoints (/login, /register, /refresh, /logout)
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !isAuthRoute && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue concurrent requests to wait for the ongoing refresh to finish
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        // Call refresh endpoint directly using raw axios to avoid interceptor recursion
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'X-DocuMind-Client': 'web-app',
            },
            timeout: 15000,
          }
        );

        const newToken = refreshResponse.data?.token || refreshResponse.data?.accessToken;
        if (!newToken) {
          throw new Error('No access token returned from refresh.');
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('documind_token', newToken);
        }

        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('documind_token');
          }
        } catch (e) {}

        // Dispatch custom event so AuthContext can clean up application state
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('documind_unauthorized'));
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Auth API Endpoints
 */
export const registerApi = async ({ name, email, password }) => {
  const response = await api.post('/auth/register', { name, email, password });
  return response.data; // { success: true, user, token }
};

export const loginApi = async ({ email, password }) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data; // { success: true, user, token }
};

export const getMeApi = async () => {
  const response = await api.get('/auth/me');
  return response.data; // { success: true, user }
};

export const refreshTokenApi = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    {},
    {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-DocuMind-Client': 'web-app',
      },
      timeout: 15000,
    }
  );
  return response.data; // { success: true, token, accessToken }
};

export const logoutApi = async () => {
  try {
    const response = await api.post('/auth/logout', {});
    return response.data;
  } catch (err) {
    // Best-effort logout: if backend is unavailable or offline, resolve safely
    return { success: false, error: err.message };
  }
};

/**
 * Health Check API
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Document API Endpoints
 */
export const uploadDocument = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
    timeout: 300000,
  });
  return response.data; // { success: true, document }
};

export const fetchDocuments = async () => {
  const response = await api.get('/documents');
  return response.data; // { success: true, count, documents }
};

export const fetchDocumentById = async (id) => {
  const response = await api.get(`/documents/${id}`);
  return response.data; // { success: true, document }
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data; // { success: true, message }
};

/**
 * Chat & AI Summary API Endpoints
 */
export const fetchMessages = async (documentId) => {
  const response = await api.get(`/documents/${documentId}/messages`);
  return response.data; // { success: true, count, messages }
};

export const sendMessage = async (documentId, content) => {
  const response = await api.post(`/documents/${documentId}/messages`, { content }, { timeout: 90000 });
  return response.data; // { success: true, userMessage, assistantMessage: { id, role, content, sources, createdAt } }
};

export const generateDocumentSummary = async (documentId) => {
  const response = await api.post(`/documents/${documentId}/summarize`, {}, { timeout: 120000 });
  return response.data; // { success: true, summary, cached }
};

export const clearMessagesApi = async (documentId) => {
  const response = await api.delete(`/documents/${documentId}/messages`);
  return response.data; // { success: true, message }
};

export default api;
