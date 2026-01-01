import axios from 'axios';
import { User, UserRole, Short, Assignment, File as FileType, Payment, CreateShortInput, UpdateShortInput, CreateAssignmentInput, AuthResponse } from '../../../shared/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout (increased for OAuth verification)
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
  checkProfileComplete: async (): Promise<{ complete: boolean; missing: { discord_username?: boolean; paypal_email?: boolean } }> => {
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
  markClipsComplete: async (id: number): Promise<Short> => {
    const response = await api.post(`/shorts/${id}/mark-clips-complete`);
    return response.data;
  },
  markEditingComplete: async (id: number): Promise<Short> => {
    const response = await api.post(`/shorts/${id}/mark-editing-complete`);
    return response.data;
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
  upload: async (
    shortId: number, 
    fileType: string, 
    file: globalThis.File,
    onUploadProgress?: (progressEvent: { loaded: number; total: number }) => void
  ): Promise<FileType> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('short_id', shortId.toString());
    formData.append('file_type', fileType);
    
    // Calculate timeout based on file size: 1 minute per 100MB, minimum 5 minutes, maximum 30 minutes
    const fileSizeMB = file.size / (1024 * 1024);
    const timeoutMinutes = Math.min(30, Math.max(5, Math.ceil(fileSizeMB / 100)));
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    const response = await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: timeoutMs,
      onUploadProgress: onUploadProgress ? (progressEvent) => {
        if (progressEvent.total) {
          onUploadProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      } : undefined,
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
  getAll: async (params?: { user_id?: number; month?: number; year?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments', { params });
    return response.data;
  },
  getPending: async (params?: { user_id?: number; month?: number; year?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments/pending', { params });
    return response.data;
  },
  getMyPayments: async (params?: { month?: number; year?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments/my-payments', { params });
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
  markPaid: async (id: number, paypalTransactionLink: string): Promise<Payment> => {
    const response = await api.post(`/payments/${id}/mark-paid`, { paypal_transaction_link: paypalTransactionLink });
    return response.data;
  },
  addIncentive: async (payment: { user_id: number; short_id?: number; amount: number; description?: string }): Promise<Payment> => {
    const response = await api.post('/payments/incentive', payment);
    return response.data;
  },
  getStats: async (params?: { user_id?: number; month?: number; year?: number }): Promise<any> => {
    const response = await api.get('/payments/stats', { params });
    return response.data;
  },
};

