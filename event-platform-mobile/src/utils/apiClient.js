import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL, STORAGE_KEYS, API_CONFIG } from './constants';
import { Platform } from 'react-native';
import { getErrorMessage, logApiError } from './errorHandler';

let logoutCallback = null;

export const setLogoutCallback = (callback) => {
  logoutCallback = callback;
};

console.log('[API] 🚀 API Client initialized:');
console.log('[API]   BASE_URL:', BASE_URL);
console.log('[API]   Platform:', Platform.OS);
console.log('[API]   Mode:', __DEV__ ? 'development' : 'production');

const AUTH_ENDPOINTS = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/forgot-password',
  '/password-reset/confirm',
];

const isAuthEndpoint = (url) => {
  return AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export const setAuthToken = async () => {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
};

export const clearAuthToken = () => {
  delete apiClient.defaults.headers.common['Authorization'];
};

apiClient.interceptors.request.use(
  async (config) => {
    console.log('[API] ➡️ Request:', config.method?.toUpperCase(), config.url);
    console.log('[API] 📡 Base URL:', config.baseURL);
    
    if (!isAuthEndpoint(config.url)) {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    console.log('[API] ❌ Request Error:', error.message);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log('[API] ✅ Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isNetworkError = !error.response && error.request;

    console.log('[API] ❌ ERROR DIAGNOSTICS:');
    console.log('[API]   Status:', error.response?.status || 'Network Error');
    console.log('[API]   URL:', error.config?.url);
    console.log('[API]   Base URL:', error.config?.baseURL);
    console.log('[API]   Method:', error.config?.method);
    console.log('[API]   Message:', error.message);
    console.log('[API]   Code:', error.code);
    console.log('[API]   Platform:', Platform.OS);
    console.log('[API]   Is Network Error:', isNetworkError);
    
    if (error.code === 'ECONNABORTED') {
      console.log('[API] ⚠️ TIMEOUT - server took too long to respond');
      console.log('[API] 💡 Fix: Check server is running on correct port');
    } else if (isNetworkError) {
      console.log('[API] ⚠️ NETWORK ERROR - cannot reach server');
      console.log('[API] 💡 DIAGNOSIS:');
      console.log('[API]   Current BASE_URL:', BASE_URL);
      console.log('[API]   ❗ Running on REAL DEVICE (Expo Go)?');
      console.log('[API]   💡 Use LAN IP (not 10.0.2.2):');
      console.log('[API]   💡   Update DEV_HOST_IP in constants.js');
      console.log('[API]   💡   Current DEV_HOST_IP:', '10.88.4.201');
      console.log('[API]   💡   Expected for Real Device: http://10.88.4.201:8000/api/v1');
      console.log('[API] 💡 VERIFY: Open http://10.88.4.201:8000/docs in phone browser');
      console.log('[API] 💡 If that works, update DEV_HOST_IP in constants.js');
    }

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response) {
      if (error.response.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return apiClient(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const authModule = await import('../api/auth');
          await authModule.refreshToken();
          const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
          
          processQueue(null, token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          
          await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          clearAuthToken();
          
          if (logoutCallback) {
            logoutCallback();
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    return Promise.reject(error);
  }
);

export { getErrorMessage };

export default apiClient;
