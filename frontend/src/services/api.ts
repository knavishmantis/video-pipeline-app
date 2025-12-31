import axios from 'axios';
import { User, UserRole, Short, Assignment, File, Payment, CreateShortInput, UpdateShortInput, CreateAssignmentInput, AuthResponse } from '../../../shared/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  loginWithGoogle: async (googleToken: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { googleToken });
    return response.data;
  },
  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  checkProfileComplete: async (): Promise<{ complete: boolean; missing: any }> => {
    const response = await api.get('/auth/profile-complete');
    return response.data;
  },
};

export const shortsApi = {
  getAll: async (params?: { status?: string; assigned?: boolean }): Promise<Short[]> => {
    const response = await api.get('/shorts', { params });
    return response.data;
  },
  getAssigned: async (): Promise<Short[]> => {
    const response = await api.get('/shorts/assigned');
    return response.data;
  },
  getById: async (id: number): Promise<Short> => {
    const response = await api.get(`/shorts/${id}`);
    return response.data;
  },
  create: async (input: CreateShortInput): Promise<Short> => {
    const response = await api.post('/shorts', input);
    return response.data;
  },
  update: async (id: number, input: UpdateShortInput): Promise<Short> => {
    const response = await api.put(`/shorts/${id}`, input);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/shorts/${id}`);
  },
};

export const assignmentsApi = {
  getAll: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments');
    return response.data;
  },
  getMyAssignments: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments/my-assignments');
    return response.data;
  },
  create: async (input: CreateAssignmentInput): Promise<Assignment> => {
    const response = await api.post('/assignments', input);
    return response.data;
  },
  update: async (id: number, updates: Partial<Assignment>): Promise<Assignment> => {
    const response = await api.put(`/assignments/${id}`, updates);
    return response.data;
  },
  markComplete: async (id: number): Promise<Assignment> => {
    const response = await api.post(`/assignments/${id}/complete`);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/assignments/${id}`);
  },
};

export const filesApi = {
  getByShortId: async (shortId: number): Promise<File[]> => {
    const response = await api.get(`/files/short/${shortId}`);
    return response.data;
  },
  upload: async (shortId: number, fileType: string, file: File): Promise<File> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('short_id', shortId.toString());
    formData.append('file_type', fileType);
    const response = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  uploadProfilePicture: async (formData: FormData): Promise<{ url: string; gcp_bucket_path: string }> => {
    const response = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/files/${id}`);
  },
};

export const usersApi = {
  getAll: async (params?: { role?: string }): Promise<User[]> => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  getById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  create: async (user: { email: string; discord_username?: string; roles: UserRole[] }): Promise<User> => {
    const response = await api.post('/users', user);
    return response.data;
  },
  update: async (id: number, updates: Partial<User>): Promise<User> => {
    const response = await api.put(`/users/${id}`, updates);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

export const paymentsApi = {
  getAll: async (params?: { user_id?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments', { params });
    return response.data;
  },
  getPending: async (params?: { user_id?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments/pending', { params });
    return response.data;
  },
  getMyPayments: async (): Promise<Payment[]> => {
    const response = await api.get('/payments/my-payments');
    return response.data;
  },
  create: async (payment: Partial<Payment>): Promise<Payment> => {
    const response = await api.post('/payments', payment);
    return response.data;
  },
  update: async (id: number, updates: Partial<Payment>): Promise<Payment> => {
    const response = await api.put(`/payments/${id}`, updates);
    return response.data;
  },
  markPaid: async (id: number): Promise<Payment> => {
    const response = await api.post(`/payments/${id}/mark-paid`);
    return response.data;
  },
};

