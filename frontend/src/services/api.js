import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

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

// Response Interceptor: handle global errors like 401 Unauthorized or 429 Rate Limit
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthRoute) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('documind_token');
        }
      } catch (e) {}
      // Dispatch custom event so AuthContext can handle auto-logout
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('documind_unauthorized'));
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
    timeout: 180000,
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
  const response = await api.post(`/documents/${documentId}/messages`, { content });
  return response.data; // { success: true, userMessage, assistantMessage: { id, role, content, sources, createdAt } }
};

export const generateDocumentSummary = async (documentId) => {
  const response = await api.post(`/documents/${documentId}/summarize`, {}, { timeout: 120000 });
  return response.data; // { success: true, summary, cached }
};

export default api;
