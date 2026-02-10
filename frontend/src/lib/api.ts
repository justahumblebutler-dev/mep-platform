import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: { id: string; email: string; name: string; firm?: string } | null;
  setAuth: (token: string, refreshToken: string, user: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: 'mep-auth',
    }
  )
);

// Auth API
export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password });
  if (data.success) {
    useAuthStore.getState().setAuth(data.accessToken, data.refreshToken, data.user);
  }
  return data;
};

export const register = async (email: string, password: string, name: string, firm?: string) => {
  const { data } = await api.post('/auth/register', { email, password, name, firm });
  if (data.success) {
    useAuthStore.getState().setAuth(data.accessToken, data.refreshToken, data.user);
  }
  return data;
};

export const logout = async () => {
  await api.post('/auth/logout');
  useAuthStore.getState().logout();
};
