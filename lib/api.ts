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
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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

export interface KBEntry {
  _id: string;
  title: string;
  content: string;
  category: string;
  isActive: boolean;
  priority: number;
  createdBy: { full_name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export const KB_CATEGORIES = [
  'About Indulge',
  'Services',
  'Pricing',
  'Policies',
  'Destinations',
  'Dining',
  'Travel',
  'Events',
  'Behaviour Rules',
  'Other',
] as const;

export const knowledgeBaseAPI = {
  getAll: async (params?: {
    category?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/knowledge-base', { params });
    return response.data as { entries: KBEntry[]; pagination: { page: number; limit: number; total: number; pages: number } };
  },

  getOne: async (id: string) => {
    const response = await api.get(`/knowledge-base/${id}`);
    return response.data as { entry: KBEntry };
  },

  create: async (data: { title: string; content: string; category: string; isActive?: boolean; priority?: number }) => {
    const response = await api.post('/knowledge-base', data);
    return response.data as { message: string; entry: KBEntry };
  },

  update: async (id: string, data: Partial<{ title: string; content: string; category: string; isActive: boolean; priority: number }>) => {
    const response = await api.put(`/knowledge-base/${id}`, data);
    return response.data as { message: string; entry: KBEntry };
  },

  toggleActive: async (id: string) => {
    const response = await api.patch(`/knowledge-base/${id}/toggle`);
    return response.data as { message: string; entry: KBEntry };
  },

  remove: async (id: string) => {
    const response = await api.delete(`/knowledge-base/${id}`);
    return response.data as { message: string };
  },
};

export default api;
