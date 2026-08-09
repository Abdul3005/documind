import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

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
  });
  return response.data;
};

export const fetchDocuments = async () => {
  const response = await api.get('/documents');
  return response.data;
};

export const fetchDocumentById = async (id) => {
  const response = await api.get(`/documents/${id}`);
  return response.data;
};

export const deleteDocument = async (id) => {
  const response = await api.delete(`/documents/${id}`);
  return response.data;
};

/**
 * Chat & AI Summary API Endpoints
 */
export const fetchMessages = async (documentId) => {
  const response = await api.get(`/documents/${documentId}/messages`);
  return response.data;
};

export const sendMessage = async (documentId, content) => {
  const response = await api.post(`/documents/${documentId}/messages`, { content });
  return response.data;
};

export const generateDocumentSummary = async (documentId) => {
  const response = await api.post(`/documents/${documentId}/summarize`);
  return response.data;
};

export default api;
