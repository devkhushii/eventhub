import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as usersApi from '../api/users';
import { STORAGE_KEYS } from '../utils/constants';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log("TOKEN:", token);
      if (!token) {
        console.log('[UserContext] No token, clearing profile');
        setProfile(null);
        return;
      }
      const data = await usersApi.getCurrentUser();
      console.log("USER:", data);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const clearProfile = useCallback(() => {
    console.log('[UserContext] Clearing profile');
    setProfile(null);
  }, []);

  const updateProfile = useCallback(async (userData) => {
    setLoading(true);
    try {
      const data = await usersApi.updateCurrentUser(userData);
      console.log('[UserContext] Profile updated:', data);
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkTokenAndFetch = async () => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log('[UserContext] Token check:', token ? 'exists' : 'none');
      if (token) {
        await fetchProfile();
      } else {
        setProfile(null);
      }
    };
    checkTokenAndFetch();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token && profile) {
        console.log('[UserContext] Token cleared, clearing profile');
        setProfile(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [profile]);

  return (
    <UserContext.Provider
      value={{
        profile,
        loading,
        fetchProfile,
        updateProfile,
        clearProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
};

export default UserContext;
