import apiClient, { setAuthToken, clearAuthToken } from '../utils/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

export const register = async (userData) => {
  const { email, password, full_name, role } = userData;

  if (!email || !password || !full_name) {
    throw new Error('Email, password, and full name are required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const payload = {
    email: email.trim().toLowerCase(),
    full_name: full_name.trim(),
    password,
    role: "CUSTOMER",
  };

  console.log("REGISTER PAYLOAD:", payload);
  const response = await apiClient.post('/auth/register', payload);
  return response.data;
};

export const login = async (credentials) => {
  const { email, password } = credentials;

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const payload = {
    email: email.trim().toLowerCase(),
    password,
  };

  console.log('[Auth API] Login payload:', JSON.stringify(payload));
  const response = await apiClient.post('/auth/login', payload);
  
  const { access_token, refresh_token, user } = response.data;
  
  await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
  await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
  await setAuthToken();

  return { access_token, refresh_token, user };
};

export const refreshToken = async () => {
  const refresh_token = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  
  if (!refresh_token) {
    throw new Error('No refresh token available');
  }

  console.log('[Auth API] Refreshing token...');
  const response = await apiClient.post('/auth/refresh', { refresh_token });
  
  const { access_token, refresh_token: new_refresh_token } = response.data;
  
  if (access_token) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
  }
  if (new_refresh_token) {
    await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, new_refresh_token);
  }
  await setAuthToken();
  
  return response.data;
};

export const verifyEmail = async (token) => {
  if (!token) {
    throw new Error('Verification token is required');
  }

  console.log('[Auth API] Verifying email with token:', token.substring(0, 10) + '...');
  const response = await apiClient.get(`/auth/verify-email?token=${token}`);
  return response.data;
};

export const forgotPassword = async (email) => {
  if (!email) {
    throw new Error('Email is required');
  }

  const payload = { email: email.trim().toLowerCase() };
  console.log('[Auth API] Forgot password:', payload.email);
  
  const response = await apiClient.post('/auth/forgot-password', payload);
  return response.data;
};

export const resetPassword = async (data) => {
  const { token, new_password } = data;

  if (!token || !new_password) {
    throw new Error('Token and new password are required');
  }

  if (new_password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const payload = {
    token,
    new_password,
  };

  console.log('[Auth API] Resetting password...');
  const response = await apiClient.post('/auth/password-reset/confirm', payload);
  return response.data;
};

export const logout = async () => {
  console.log('[Auth API] Logging out...');
  await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  clearAuthToken();
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/users/me');
  return response.data;
};

export default {
  register,
  login,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logout,
  getCurrentUser,
};
