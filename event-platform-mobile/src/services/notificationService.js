import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as vendorsApi from '../api/vendors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_STORAGE_KEY = 'device_notification_token';

const EnvironmentInfo = {
  isSupported: false,
  isDevice: false,
  hasNotifications: false,
  projectId: null,
};

export const detectEnvironment = () => {
  const isDevice = Device.isDevice;
  const hasNotifications = typeof Notifications?.addNotificationReceivedObserver === 'function';
  
  const projectId = 
    Constants.expoConfig?.extra?.eas?.projectId || 
    Constants.expoConfig?.extra?.projectId ||
    Constants.expoConfig?.projectId;

  const isSupported = isDevice && hasNotifications && !!projectId;

  Object.assign(EnvironmentInfo, {
    isDevice,
    hasNotifications,
    projectId,
    isSupported,
  });

  console.log('[Notifications] Environment detection:', {
    isDevice,
    hasNotifications,
    projectId: projectId ? `${projectId.substring(0, 8)}...` : null,
    isSupported,
  });

  return EnvironmentInfo;
};

export const getEnvironmentInfo = () => EnvironmentInfo;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const requestNotificationPermissions = async () => {
  const env = detectEnvironment();
  console.log('[Notifications] Environment check:', env);

  if (!env.isDevice) {
    console.log('[Notifications] ⚠️ Push notifications require a physical device');
    console.log('[Notifications] Running on emulator/simulator - notifications will not work');
    return null;
  }

  if (!env.hasNotifications) {
    console.log('[Notifications] ⚠️ expo-notifications not available');
    console.log('[Notifications] This may be running in Expo Go. Use development build for push notifications.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Existing permission status:', existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      console.log('[Notifications] Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Notifications] Requested permission status:', status);
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] ❌ Permission not granted:', finalStatus);
      return null;
    }

    console.log('[Notifications] ✅ Permission granted');

    if (!env.projectId) {
      console.log('[Notifications] ⚠️ No projectId configured - cannot get push token');
      console.log('[Notifications] Configure expo.projectId in app.json/app.config.js');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: env.projectId,
    });

    console.log('[Notifications] ✅ Expo push token obtained:', token.data.substring(0, 40) + '...');
    return token.data;

  } catch (error) {
    console.log('[Notifications] ❌ Error getting push token:', error.message);
    return null;
  }
};

export const registerDeviceToken = async (fcmToken) => {
  if (!fcmToken) {
    console.log('[Notifications] No FCM token to register');
    return false;
  }

  try {
    console.log('[Notifications] Registering device token...');
    await vendorsApi.registerDeviceToken(fcmToken, 'expo');
    console.log('[Notifications] ✅ Token registered successfully');
    
    await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, fcmToken);
    return true;
  } catch (error) {
    console.log('[Notifications] Failed to register token:', error?.response?.data || error.message);
    return false;
  }
};

export const unregisterDeviceToken = async () => {
  try {
    const storedToken = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (storedToken) {
      await vendorsApi.unregisterDeviceToken(storedToken);
      console.log('[Notifications] Token unregistered');
    }
    await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
  } catch (error) {
    console.log('[Notifications] Failed to unregister token:', error?.message);
  }
};

export const setupNotificationHandlers = (onNotificationReceived, onNotificationResponse) => {
  const env = detectEnvironment();
  
  if (!env.hasNotifications) {
    console.log('[Notifications] Cannot setup handlers - notifications not available');
    return () => {};
  }

  console.log('[Notifications] Setting up notification handlers...');

  let foregroundSubscription = null;
  let responseSubscription = null;

  try {
    foregroundSubscription = Notifications.addNotificationReceivedObserver((notification) => {
      console.log('[Notifications] 📬 Foreground notification received');
      console.log('[Notifications] Notification:', JSON.stringify({
        title: notification?.request?.content?.title,
        body: notification?.request?.content?.body,
      }, null, 2));
      
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    responseSubscription = Notifications.addNotificationResponseReceivedObserver((response) => {
      console.log('[Notifications] 👆 Notification response received');
      console.log('[Notifications] Response action:', response?.actionIdentifier);
      console.log('[Notifications] Notification:', JSON.stringify({
        title: response?.notification?.request?.content?.title,
      }, null, 2));
      
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });

    console.log('[Notifications] ✅ Notification handlers registered');
  } catch (error) {
    console.log('[Notifications] ❌ Error setting up handlers:', error.message);
  }

  return () => {
    console.log('[Notifications] Cleaning up notification handlers');
    if (foregroundSubscription) {
      try {
        foregroundSubscription.remove();
      } catch (e) {
        console.log('[Notifications] Error removing foreground handler:', e.message);
      }
    }
    if (responseSubscription) {
      try {
        responseSubscription.remove();
      } catch (e) {
        console.log('[Notifications] Error removing response handler:', e.message);
      }
    }
  };
};

export const updateBadgeCount = async (count) => {
  const env = detectEnvironment();
  
  if (!env.hasNotifications) {
    console.log('[Notifications] Badge not supported - notifications unavailable');
    return;
  }

  try {
    await Notifications.setBadgeCountAsync(count);
    console.log('[Notifications] Badge count updated:', count);
  } catch (error) {
    console.log('[Notifications] Failed to set badge:', error.message);
  }
};

export const getStoredToken = async () => {
  try {
    return await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
  } catch (error) {
    console.log('[Notifications] Error reading stored token:', error.message);
    return null;
  }
};

export default {
  detectEnvironment,
  getEnvironmentInfo,
  requestNotificationPermissions,
  registerDeviceToken,
  unregisterDeviceToken,
  setupNotificationHandlers,
  updateBadgeCount,
  getStoredToken,
};