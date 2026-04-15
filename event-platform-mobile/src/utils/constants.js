import { Platform } from 'react-native';
import Constants from 'expo-constants';

const PORT = '8000';
const API_VERSION = 'api/v1';
const WS_PATH = '';

const DEV_HOST_IP = '10.88.4.201';

export const API_ENV = {
  ANDROID_EMULATOR: `http://10.0.2.2:${PORT}/${API_VERSION}`,
  ANDROID_DEVICE: `http://${DEV_HOST_IP}:${PORT}/${API_VERSION}`,
  IOS_SIMULATOR: `http://localhost:${PORT}/${API_VERSION}`,
  IOS_DEVICE: `http://${DEV_HOST_IP}:${PORT}/${API_VERSION}`,
};

const getBaseUrl = () => {
  const isDev = __DEV__;

  if (!isDev) {
    return process.env.API_BASE_URL || `http://${DEV_HOST_IP}:${PORT}/${API_VERSION}`;
  }

  const deviceId = Constants.systemVersion;
  const isSimulator = !deviceId || deviceId.includes('.');
  
  let baseUrl;
  if (Platform.OS === 'ios') {
    baseUrl = isSimulator ? API_ENV.IOS_SIMULATOR : API_ENV.IOS_DEVICE;
  } else {
    baseUrl = isSimulator ? API_ENV.ANDROID_EMULATOR : API_ENV.ANDROID_DEVICE;
  }

  console.log('[Config] 🌐 API Configuration:');
  console.log('[Config]   Platform:', Platform.OS);
  console.log('[Config]   isSimulator:', isSimulator);
  console.log('[Config]   systemVersion:', deviceId);
  console.log('[Config]   DEV_HOST_IP:', DEV_HOST_IP);
  console.log('[Config]   BASE_URL:', baseUrl);
  console.log('[Config]   Mode:', isDev ? 'development' : 'production');

  return baseUrl;
};

export const BASE_URL = getBaseUrl();

export const getImageUrl = (path) => {
  if (!path) {
    console.log('[IMAGE URL] Empty path, returning null');
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    console.log('[IMAGE URL] Already full URL:', path);
    return path;
  }

  const baseWithoutApi = BASE_URL.replace('/api/v1', '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${baseWithoutApi}${normalizedPath}`;
  
  console.log('[IMAGE URL] Generated URL:', fullUrl);
  return fullUrl;
};

const getWebSocketBaseUrl = () => {
  const isDev = __DEV__;

  if (!isDev) {
    return process.env.WS_BASE_URL || `ws://${DEV_HOST_IP}:${PORT}`;
  }

  const deviceId = Constants.systemVersion;
  const isSimulator = !deviceId || deviceId.includes('.');

  let wsBaseUrl;
  if (Platform.OS === 'ios') {
    wsBaseUrl = isSimulator ? `ws://localhost:${PORT}` : `ws://${DEV_HOST_IP}:${PORT}`;
  } else {
    wsBaseUrl = isSimulator ? `ws://10.0.2.2:${PORT}` : `ws://${DEV_HOST_IP}:${PORT}`;
  }

  console.log('[Config] 🌐 WebSocket Configuration:');
  console.log('[Config]   Platform:', Platform.OS);
  console.log('[Config]   isSimulator:', isSimulator);
  console.log('[Config]   WS_BASE_URL:', wsBaseUrl);

  return wsBaseUrl;
};

export const WS_BASE_URL = getWebSocketBaseUrl();

export const getWebSocketUrl = (endpoint, queryParams = '') => {
  const baseUrl = WS_BASE_URL;
  const separator = queryParams && !queryParams.startsWith('?') ? '?' : '';
  const fullUrl = `${baseUrl}${endpoint}${separator}${queryParams}`;
  
  console.log('[Config] 📡 WebSocket URL:', fullUrl);
  return fullUrl;
};

export const API_CONFIG = {
  port: PORT,
  version: API_VERSION,
  timeout: 20000,
};

export const RAZORPAY_KEY_ID = 'rzp_test_SVuHC8esps5Wlh';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

export const ROLES = {
  USER: 'user',
  VENDOR: 'vendor',
  ADMIN: 'admin',
};

export const LISTING_TYPES = {
  EVENT_SPACE: 'event_space',
  EQUIPMENT: 'equipment',
  CATERING: 'catering',
};

export const BOOKING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  AWAITING_PAYMENT: 'awaiting_payment',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

export default {
  BASE_URL,
  WS_BASE_URL,
  getWebSocketUrl,
  getImageUrl,
  STORAGE_KEYS,
  ROLES,
  LISTING_TYPES,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  API_CONFIG,
  API_ENV,
};