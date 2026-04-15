import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as vendorsApi from '../api/vendors';
import { STORAGE_KEYS } from '../utils/constants';

const VendorContext = createContext(null);

export const VendorProvider = ({ children }) => {
  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchVendorProfile = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log("TOKEN:", token);
      if (!token) {
        console.log('[VendorContext] No token, clearing vendor');
        setVendorProfile(null);
        return null;
      }
      const data = await vendorsApi.getVendorProfile();
      setVendorProfile(data);
      console.log("VENDOR:", data);
      return data;
    } catch (error) {
      console.error('Failed to fetch vendor profile:', error);
      setVendorProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkTokenAndFetch = async () => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      console.log('[VendorContext] Token check:', token ? 'exists' : 'none');
      if (token) {
        await fetchVendorProfile();
      } else {
        setVendorProfile(null);
      }
    };
    checkTokenAndFetch();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token && vendorProfile) {
        console.log('[VendorContext] Token cleared, clearing vendor');
        setVendorProfile(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [vendorProfile]);

  const clearVendor = useCallback(() => {
    console.log('[VendorContext] Clearing vendor');
    setVendorProfile(null);
  }, []);

  const becomeVendor = async (vendorData) => {
    setLoading(true);
    try {
      const data = await vendorsApi.becomeVendor(vendorData);
      setVendorProfile(data);
      return data;
    } catch (error) {
      console.error('Failed to become vendor:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const isVendor = () => {
    if (!vendorProfile) return false;
    const status = vendorProfile.verification_status?.toUpperCase();
    return status === 'APPROVED' || status === 'VERIFIED';
  };

  return (
    <VendorContext.Provider
      value={{
        vendorProfile,
        loading,
        fetchVendorProfile,
        becomeVendor,
        isVendor,
        clearVendor,
      }}
    >
      {children}
    </VendorContext.Provider>
  );
};

export const useVendor = () => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('useVendor must be used within VendorProvider');
  }
  return context;
};

export default VendorContext;
