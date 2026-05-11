import messaging from '@react-native-firebase/messaging';
import * as vendorsApi from '../api/vendors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_STORAGE_KEY = 'fcm_token';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

export const requestPermission = async () => {
  console.log('[NotifService] Requesting FCM permission...');
  try {
    const authStatus = await messaging().requestPermission();
    const enabled = 
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    console.log('[NotifService] Permission:', enabled ? 'GRANTED' : 'DENIED');
    return enabled;
  } catch (error) {
    console.log('[NotifService] Permission error:', error.message);
    return false;
  }
};

export const getFCMToken = async (retryCount = 0) => {
  console.log(`[NotifService] Getting FCM token (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
  
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log('[NotifService] FCM token obtained:', token.substring(0, 20) + '...');
      return token;
    }
    console.log('[NotifService] Empty token received');
    return null;
  } catch (error) {
    console.log('[NotifService] getToken failed:', error.message);
    
    if (retryCount < MAX_RETRIES - 1) {
      console.log(`[NotifService] Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return getFCMToken(retryCount + 1);
    }
    return null;
  }
};

export const registerToken = async (token) => {
  if (!token) {
    console.log('[NotifService] No token to register');
    return false;
  }

  try {
    console.log('[NotifService] Registering token with backend...');
    await vendorsApi.registerDeviceToken(token, 'fcm');
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, token);
    console.log('[NotifService] Token registered');
    return true;
  } catch (error) {
    console.log('[NotifService] Registration failed:', error.message);
    return false;
  }
};

export const unregisterToken = async () => {
  try {
    const storedToken = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (storedToken) {
      await vendorsApi.unregisterDeviceToken(storedToken);
    }
    await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
    console.log('[NotifService] Token unregistered');
  } catch (error) {
    console.log('[NotifService] Unregister error:', error.message);
  }
};

export const setupMessageHandlers = (onMessage) => {
  console.log('[NotifService] Setting up FCM handlers...');

  messaging().onMessage(async (remoteMessage) => {
    console.log('[NotifService] Foreground message:', remoteMessage.notification?.title);
    if (onMessage) onMessage(remoteMessage);
  });

  messaging().onTokenRefresh(async (token) => {
    console.log('[NotifService] Token refreshed');
    await registerToken(token);
  });

  return () => {};
};

export const getStoredToken = async () => {
  try {
    return await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
  } catch (error) {
    return null;
  }
};

export const initializeNotifications = async () => {
  console.log('[NotifService] Initializing FCM...');
  
  const permissionGranted = await requestPermission();
  if (!permissionGranted) {
    console.log('[NotifService] Permission denied');
    return null;
  }

  const token = await getFCMToken();
  if (token) {
    await registerToken(token);
  }

  return token;
};

export default {
  requestPermission,
  getFCMToken,
  registerToken,
  unregisterToken,
  setupMessageHandlers,
  getStoredToken,
  initializeNotifications,
};