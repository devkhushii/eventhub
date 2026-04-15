import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as authApi from '../api/auth';
import { STORAGE_KEYS } from '../utils/constants';
import { setLogoutCallback, clearAuthToken } from '../utils/apiClient';

const AUTH_TIMEOUT_MS = 3000;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
    
    setLogoutCallback(() => {
      handleLogout();
    });
  }, []);

  const checkAuth = async () => {
    let isTimedOut = false;
    
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      console.log('[Auth] Timeout reached, forcing logout');
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }, AUTH_TIMEOUT_MS);

    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log('[Auth] Checking token:', token ? 'Found' : 'Not found');
      
      if (!token) {
        console.log('[Auth] No token, going to login');
        setUser(null);
        setIsAuthenticated(false);
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }

      const userData = await authApi.getCurrentUser();
      
      if (isTimedOut) return;
      
      console.log('[Auth] Token valid, user:', userData.email);
      setUser(userData);
      setIsAuthenticated(true);
      clearTimeout(timeoutId);
    } catch (error) {
      if (isTimedOut) return;
      
      console.log('[Auth] Token check failed:', error.response?.status || error.message);
      
      if (error.response?.status === 401) {
        console.log('[Auth] 401 - Attempting token refresh...');
        try {
          await authApi.refreshToken();
          const userData = await authApi.getCurrentUser();
          
          if (isTimedOut) return;
          
          console.log('[Auth] Refresh success, user:', userData.email);
          setUser(userData);
          setIsAuthenticated(true);
          clearTimeout(timeoutId);
        } catch (refreshError) {
          console.log('[Auth] Refresh failed:', refreshError.message);
          console.log('[Auth] Invalid tokens, logging out');
          await handleLogout();
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      if (!isTimedOut) {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }
  };

  const login = async (email, password) => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      console.log('[Auth] Logging in...');
      const data = await authApi.login({ email, password });
      console.log('[Auth] Login successful');
      console.log("USER:", data.user);
      
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      console.log('[Auth] Login failed:', error);
      throw error;
    }
  };

  const register = async (userData) => {
    const { email, password, full_name, role } = userData;
    
    if (!email || !password || !full_name) {
      throw new Error('Email, password, and full name are required');
    }

    try {
      console.log('[Auth] Registering user...');
      const data = await authApi.register({ email, password, full_name, role });
      console.log('[Auth] Registration successful');
      return data;
    } catch (error) {
      console.log('[Auth] Registration failed:', error);
      throw error;
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      console.log('[Auth] Logging out...');
      await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      clearAuthToken();
      setUser(null);
      setIsAuthenticated(false);
      console.log('[Auth] Logout complete');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, []);

  const logout = async () => {
    await handleLogout();
  };

  const forgotPassword = async (email) => {
    if (!email) {
      throw new Error('Email is required');
    }
    return await authApi.forgotPassword(email);
  };

  const resetPassword = async (data) => {
    const { token, new_password } = data;
    if (!token || !new_password) {
      throw new Error('Token and new password are required');
    }
    return await authApi.resetPassword(data);
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      console.log('[Auth] Refresh user failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
