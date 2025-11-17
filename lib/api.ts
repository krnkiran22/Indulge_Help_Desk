import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://indulgeconcierge.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
};

export const chatAPI = {
  getHistory: async (roomId: string, limit: number = 50) => {
    const response = await api.get(`/chat/history/${roomId}`, {
      params: { limit },
    });
    return response.data;
  },
  
  getRooms: async () => {
    const response = await api.get('/chat/rooms');
    return response.data;
  },
  
  clearHistory: async (roomId: string) => {
    const response = await api.delete(`/chat/history/${roomId}`);
    return response.data;
  },
};

export default api;
