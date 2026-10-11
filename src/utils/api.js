import axios from 'axios';
import { STORAGE_KEYS } from './storage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://snmflix-backend.onrender.com/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

export default api;
