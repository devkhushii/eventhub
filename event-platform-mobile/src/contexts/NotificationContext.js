import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import * as notificationsApi from '../api/notifications';
import * as vendorsApi from '../api/vendors';
import { useAuth } from './AuthContext';
import wsService from '../utils/websocket';
import { openChat } from '../utils/navigationService';

const POLLING_INTERVAL = 30000;
const MAX_TOKEN_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [fcmToken, setFcmToken] = useState(null);
  const [isRealtimeAvailable, setIsRealtimeAvailable] = useState(false);

  const pollingIntervalRef = useRef(null);
  const previousBookingsRef = useRef([]);
  const fcmUnsubscribeRef = useRef(null);
  const handlersRegisteredRef = useRef(false);  // BUG FIX: track if handlers already registered

  const isVendor = user?.role?.toUpperCase() === 'VENDOR';

  // ========================================
  // FCM Permission
  // ========================================
  const requestPermission = useCallback(async () => {
    console.log('[NotifCtx] Requesting FCM permission...');
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      console.log('[NotifCtx] Permission status:', enabled ? 'GRANTED' : 'DENIED');
      setPermissionStatus(enabled ? 'granted' : 'denied');
      return enabled;
    } catch (error) {
      console.log('[NotifCtx] Permission request failed:', error.message);
      return false;
    }
  }, []);

  // ========================================
  // FCM Token
  // ========================================
  const getFCMToken = useCallback(async (retryCount = 0) => {
    console.log(`[NotifCtx] Getting FCM token (attempt ${retryCount + 1}/${MAX_TOKEN_RETRIES})...`);
    try {
      const token = await messaging().getToken();
      if (token) {
        console.log('[NotifCtx] FCM token obtained:', token.substring(0, 20) + '...');
        setFcmToken(token);
        return token;
      } else {
        console.log('[NotifCtx] Empty token received');
        return null;
      }
    } catch (error) {
      console.log('[NotifCtx] getToken error:', error.message);
      if (retryCount < MAX_TOKEN_RETRIES - 1) {
        console.log(`[NotifCtx] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return getFCMToken(retryCount + 1);
      }
      return null;
    }
  }, []);

  // ========================================
  // Token Registration
  // ========================================
  const registerToken = useCallback(async (token) => {
    if (!token) {
      console.log('[NotifCtx] No token to register');
      return false;
    }
    console.log('[NotifCtx] Registering FCM token with backend...');
    try {
      await notificationsApi.registerDeviceToken(token);
      console.log('[NotifCtx] Token registered successfully!');
      return true;
    } catch (error) {
      console.log('[NotifCtx] Backend registration failed:', error.message);
      return false;
    }
  }, []);

  // ========================================
  // FCM Initialization
  // ========================================
  const initializeFCM = useCallback(async () => {
    console.log('[NotifCtx] ===== FCM INITIALIZATION =====');
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      console.log('[NotifCtx] Permission denied');
      return null;
    }
    const token = await getFCMToken();
    if (token) {
      await registerToken(token);
    }
    console.log('[NotifCtx] ===== FCM INIT COMPLETE =====');
    return token;
  }, [requestPermission, getFCMToken, registerToken]);

  // ========================================
  // NOTIFICATION TAP HANDLER
  // ========================================
  const handleNotificationTap = useCallback((remoteMessage, source) => {
    console.log('[NotifTap] ========================================');
    console.log('[NotifTap] 🔔 NOTIFICATION TAPPED');
    console.log('[NotifTap] Source:', source);

    if (!remoteMessage) {
      console.log('[NotifTap] ❌ remoteMessage is null/undefined');
      return;
    }

    const data = remoteMessage.data || {};
    console.log('[NotifTap] data payload:', JSON.stringify(data));
    console.log('[NotifTap] notification.title:', remoteMessage.notification?.title);
    console.log('[NotifTap] notification.body:', remoteMessage.notification?.body);

    const chatId = data.chat_id || data.reference_id;
    const chatName = data.chat_name || remoteMessage.notification?.title?.replace('New message from ', '') || 'Chat';
    const notificationType = data.type;

    console.log('[NotifTap] Parsed → type:', notificationType, '| chatId:', chatId, '| chatName:', chatName);

    if (notificationType === 'MESSAGE' && chatId) {
      console.log('[NotifTap] ✅ Navigating to ChatDetail...');
      // For cold start: nav container may not be mounted yet.
      // openChat queues it if not ready, onReady will flush it.
      // Add a small delay for cold start to let auth resolve first.
      const delay = source === 'getInitialNotification' ? 1500 : 300;
      console.log('[NotifTap] Using delay:', delay, 'ms');
      setTimeout(() => {
        console.log('[NotifTap] Executing openChat now');
        openChat(chatId, chatName);
      }, delay);
    } else {
      console.log('[NotifTap] Not a MESSAGE notification or no chatId');
    }
    console.log('[NotifTap] ========================================');
  }, []);

  // ========================================
  // FCM Message Handlers Setup
  // BUG FIX: Only register ONCE per app lifecycle. 
  // FCM handlers are global singletons — re-registering creates duplicates.
  // ========================================
  const setupMessageHandlers = useCallback(() => {
    // CRITICAL: Only register once
    if (handlersRegisteredRef.current) {
      console.log('[NotifCtx] FCM handlers already registered — skipping');
      return;
    }
    handlersRegisteredRef.current = true;

    console.log('[NotifCtx] Setting up FCM message handlers (FIRST TIME)...');

    // 1. FOREGROUND: message arrives while app is in foreground
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      console.log('[NotifCtx] 📩 Foreground message received');
      console.log('[NotifCtx] Title:', remoteMessage.notification?.title);
      console.log('[NotifCtx] Data:', JSON.stringify(remoteMessage.data));
      // Don't navigate — user is in the app. WS/polling handles updates.
    });

    // 2. BACKGROUND TAP: user taps notification while app was in background
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[NotifTap] 📲 onNotificationOpenedApp FIRED');
      handleNotificationTap(remoteMessage, 'onNotificationOpenedApp');
    });

    // 3. Token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
      console.log('[NotifCtx] 🔄 Token refreshed');
      setFcmToken(token);
      await registerToken(token);
    });

    // Store unsubscribe for cleanup
    fcmUnsubscribeRef.current = () => {
      console.log('[NotifCtx] Cleaning up FCM handlers');
      unsubscribeForeground();
      unsubscribeOpenedApp();
      unsubscribeTokenRefresh();
      handlersRegisteredRef.current = false;
    };

    // 4. COLD START: app was killed, user taps notification to open it
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('[NotifTap] 🧊 getInitialNotification — COLD START notification tap');
        handleNotificationTap(remoteMessage, 'getInitialNotification');
      } else {
        console.log('[NotifCtx] getInitialNotification — normal app launch (no notification)');
      }
    }).catch((error) => {
      console.log('[NotifCtx] getInitialNotification error:', error.message);
    });

    console.log('[NotifCtx] ✅ All FCM handlers registered');
  }, [registerToken, handleNotificationTap]);

  // ========================================
  // WebSocket Notification Handler
  // ========================================
  const wsNotificationHandlerRef = useRef(null);

  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated) return;

    // Remove previous handler if exists (prevents duplicates)
    if (wsNotificationHandlerRef.current) {
      wsService.removeListener('notification', wsNotificationHandlerRef.current);
    }

    // BUG FIX: websocket.js already unwraps the payload.
    // It calls notifyListeners('notification', data.data) where data.data is the
    // inner notification object {id, type: "MESSAGE", title, message, ...}.
    // We should NOT check data.type === 'notification' — that was the outer wrapper type.
    const handler = (notificationData) => {
      if (notificationData) {
        console.log('[NotifCtx] WebSocket notification received:', notificationData.title || notificationData.type);
        setNotifications(prev => {
          if (notificationData.id) {
            const exists = prev.find(n => n.id === notificationData.id);
            if (exists) return prev;
          }
          return [notificationData, ...prev];
        });
        setUnreadCount(prev => prev + 1);
      }
    };

    wsNotificationHandlerRef.current = handler;
    console.log('[NotifCtx] Adding WebSocket notification listener');
    wsService.addListener('notification', handler);

    // CRITICAL: Actually open the notification WebSocket connection.
    // Without this, the listener above never fires — there's no WS to receive data.
    console.log('[NotifCtx] Connecting notification WebSocket...');
    wsService.connectNotifications();

    setIsRealtimeAvailable(true);
  }, [isAuthenticated]);

  // ========================================
  // Fetch Notifications
  // ========================================
  const fetchNotifications = useCallback(async (params = {}) => {
    if (!isAuthenticated) return;
    try {
      const data = await notificationsApi.getNotifications(params);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.log('[NotifCtx] Fetch error:', error.response?.status);
    }
  }, [isAuthenticated]);

  const fetchPendingCount = useCallback(async () => {
    if (!isVendor || !isAuthenticated) return;
    try {
      const data = await vendorsApi.getVendorBookings();
      const bookings = Array.isArray(data) ? data : data?.data || [];
      const pending = bookings.filter(b => b.status?.toUpperCase() === 'PENDING').length;
      setPendingCount(pending);
      previousBookingsRef.current = bookings;
    } catch (error) {
      console.log('[NotifCtx] Pending count error:', error.message);
    }
  }, [isVendor, isAuthenticated]);

  // ========================================
  // Mark Read
  // ========================================
  const markAsRead = async (notificationId) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notificationsApi.markAsRead(notificationId);
    } catch (error) {
      console.log('[NotifCtx] Mark read error:', error.response?.status);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllAsRead();
    } catch (error) {
      console.log('[NotifCtx] Mark all error:', error.response?.status);
    }
  };

  // ========================================
  // Polling
  // ========================================
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    fetchPendingCount();
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
      fetchPendingCount();
    }, POLLING_INTERVAL);
  }, [fetchNotifications, fetchPendingCount]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // ========================================
  // Auth State Effect
  // ========================================
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[NotifCtx] ✅ Authenticated — initializing');
      setupMessageHandlers();   // registers FCM only once (guard inside)
      initializeFCM();
      connectWebSocket();
      fetchNotifications();
      if (isVendor) fetchPendingCount();
      startPolling();
    } else {
      console.log('[NotifCtx] ❌ Not authenticated — cleaning up');
      stopPolling();

      // Remove WS notification listener
      if (wsNotificationHandlerRef.current) {
        wsService.removeListener('notification', wsNotificationHandlerRef.current);
        wsNotificationHandlerRef.current = null;
      }

      // DO NOT unsubscribe FCM handlers on logout — they must persist
      // because getInitialNotification / onNotificationOpenedApp must work
      // even before authentication completes on cold start.

      // Reset state
      setNotifications([]);
      setUnreadCount(0);
      setPendingCount(0);
      setFcmToken(null);
      setIsRealtimeAvailable(false);
    }
    return () => stopPolling();
  }, [isAuthenticated, isVendor]);

  // ========================================
  // App State (foreground/background)
  // ========================================
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('[NotifCtx] App state changed to:', nextAppState);
      if (nextAppState === 'active' && isAuthenticated) {
        console.log('[NotifCtx] App foregrounded — refreshing notifications');
        fetchNotifications();
        fetchPendingCount();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated]);

  // ========================================
  // Cleanup on unmount (app teardown only)
  // ========================================
  useEffect(() => {
    return () => {
      if (wsNotificationHandlerRef.current) {
        wsService.removeListener('notification', wsNotificationHandlerRef.current);
      }
      if (fcmUnsubscribeRef.current) {
        fcmUnsubscribeRef.current();
      }
    };
  }, []);

  const value = {
    notifications,
    unreadCount: unreadCount + pendingCount,
    pendingCount,
    permissionStatus,
    fcmToken,
    isRealtimeAvailable,
    refreshNotifications: fetchNotifications,
    fetchPendingCount,
    markAsRead,
    markAllAsRead,
    refreshToken: initializeFCM,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export default NotificationContext;