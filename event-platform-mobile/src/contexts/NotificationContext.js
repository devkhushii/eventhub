/**
 * NotificationContext.js
 * 
 * Notification system with Expo push token registration,
 * WebSocket real-time updates, and local notifications.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import apiClient from '../utils/apiClient';
import * as notificationsApi from '../api/notifications';
import * as vendorsApi from '../api/vendors';
import { useAuth } from './AuthContext';
import wsService from '../utils/websocket';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const POLLING_INTERVAL = 30000;
const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [isRealtimeAvailable, setIsRealtimeAvailable] = useState(false);

  const pollingIntervalRef = useRef(null);
  const previousBookingsRef = useRef([]);
  const notificationReceivedRef = useRef(null);
  const notificationResponseRef = useRef(null);

  const isVendor = user?.role?.toUpperCase() === 'VENDOR';

  const registerExpoToken = useCallback(async (token) => {
    if (!token) return;

    try {
      await notificationsApi.registerExpoToken(token);
      setExpoPushToken(token);
      console.log('[NotificationContext] Expo token registered:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error('[NotificationContext] Failed to register token:', error);
    }
  }, []);

  const getAndRegisterExpoToken = useCallback(async () => {
    if (!Device.isDevice) {
      console.log('[NotificationContext] Not a physical device, skipping push token');
      return;
    }

    try {
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: 'event-platform-mobile', // Replace with your Expo project ID
      });

      if (data) {
        console.log('[NotificationContext] Got Expo token:', data.substring(0, 20) + '...');
        await registerExpoToken(data);
      }
    } catch (error) {
      console.error('[NotificationContext] Failed to get Expo token:', error);
    }
  }, [registerExpoToken]);

  const handleWebSocketNotification = useCallback((data) => {
    if (data.type === 'notification' && data.data) {
      const newNotification = data.data;
      console.log('[NotificationContext] WebSocket notification received:', newNotification.title);

      setNotifications(prev => {
        const exists = prev.find(n => n.id === newNotification.id);
        if (exists) return prev;
        return [newNotification, ...prev];
      });
      setUnreadCount(prev => prev + 1);

      triggerNotification(newNotification.title, newNotification.message, {
        notification_id: newNotification.id,
        type: newNotification.type,
      });
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated) return;

    try {
      wsService.addListener('notification', handleWebSocketNotification);
      setIsRealtimeAvailable(true);
    } catch (error) {
      console.log('[NotificationContext] WebSocket not available:', error.message);
    }
  }, [isAuthenticated, handleWebSocketNotification]);

  // Schedule local notification
  const scheduleLocalNotification = useCallback(async (title, body, data = {}, delayMs = 0) => {
    if (permissionStatus !== 'granted') {
      console.log('[NotificationContext] No permission');
      return null;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          data: data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: delayMs > 0 ? { seconds: delayMs / 1000 } : null,
      });

      console.log('[NotificationContext] Notification scheduled:', notificationId);

      const newNotification = {
        id: notificationId,
        title,
        message: body,
        data,
        is_read: false,
        created_at: new Date().toISOString(),
        is_local: true,
      };

      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      return notificationId;
    } catch (error) {
      console.log('[NotificationContext] Error:', error.message);
      return null;
    }
  }, [permissionStatus]);

  const triggerNotification = useCallback((title, body, data = {}) => {
    return scheduleLocalNotification(title, body, data, 0);
  }, [scheduleLocalNotification]);

  const cancelNotification = useCallback(async (notificationId) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.log('[NotificationContext] Cancel error:', error.message);
    }
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotifications();
    } catch (error) {
      console.log('[NotificationContext] Cancel all error:', error.message);
    }
  }, []);

  const fetchNotifications = useCallback(async (params = {}) => {
    if (!isAuthenticated) return;

    try {
      const data = await notificationsApi.getNotifications(params);
      const notifs = data.notifications || [];
      setNotifications(notifs);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.log('[NotificationContext] Fetch error:', error.response?.status);
    }
  }, [isAuthenticated]);

  const fetchPendingCount = useCallback(async () => {
    if (!isVendor || !isAuthenticated) return;

    try {
      const data = await vendorsApi.getVendorBookings();
      const bookings = Array.isArray(data) ? data : data?.data || [];
      const pending = bookings.filter(b => b.status?.toUpperCase() === 'PENDING').length;
      setPendingCount(pending);

      const previousPending = previousBookingsRef.current.filter(
        b => b.status?.toUpperCase() === 'PENDING'
      ).length;

      if (pending > previousPending && previousPending > 0) {
        triggerNotification(
          'New Booking Request!',
          `You have ${pending} pending booking${pending > 1 ? 's' : ''} to review.`
        );
      }

      previousBookingsRef.current = bookings;
    } catch (error) {
      console.error('[NotificationContext] Pending count error:', error);
    }
  }, [isVendor, isAuthenticated, triggerNotification]);

  const markAsRead = async (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await notificationsApi.markAsRead(notificationId);
    } catch (error) {
      console.log('[NotificationContext] Mark read error:', error.response?.status);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await notificationsApi.markAllAsRead();
    } catch (error) {
      console.log('[NotificationContext] Mark all error:', error.response?.status);
    }
  };

  const requestPermissions = useCallback(async () => {
    if (!Device.isDevice) {
      console.log('[NotificationContext] Not a physical device');
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setPermissionStatus(finalStatus);
      return finalStatus === 'granted';
    } catch (error) {
      console.log('[NotificationContext] Permission error:', error);
      return false;
    }
  }, []);

  const setupNotificationHandlers = useCallback(() => {
    notificationReceivedRef.current = Notifications.addNotificationReceivedObserver(
      (notification) => {
        console.log('[NotificationContext] Notification received');
        fetchNotifications();
      }
    );

    notificationResponseRef.current = Notifications.addNotificationResponseReceivedObserver(
      (response) => {
        console.log('[NotificationContext] Notification tapped');
      }
    );
  }, [fetchNotifications]);

  const updateBadgeCount = useCallback(async (count) => {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.log('[NotificationContext] Badge error:', error.message);
    }
  }, []);

  const initializeNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    console.log('[NotificationContext] Initializing...');

    const granted = await requestPermissions();

    if (granted) {
      setupNotificationHandlers();
      await getAndRegisterExpoToken();
      connectWebSocket();
      setIsRealtimeAvailable(true);
    }

    await fetchNotifications();

    if (isVendor) {
      await fetchPendingCount();
    }
  }, [isAuthenticated, isVendor, requestPermissions, setupNotificationHandlers, getAndRegisterExpoToken, connectWebSocket, fetchNotifications, fetchPendingCount]);

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

  useEffect(() => {
    if (isAuthenticated) {
      initializeNotifications();
    } else {
      stopPolling();
      setNotifications([]);
      setUnreadCount(0);
      setPendingCount(0);
      setExpoPushToken(null);
    }
    return () => stopPolling();
  }, [isAuthenticated, initializeNotifications, stopPolling]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && isAuthenticated) {
        fetchNotifications();
        fetchPendingCount();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, fetchNotifications, fetchPendingCount]);

  useEffect(() => {
    return () => {
      if (notificationReceivedRef.current) notificationReceivedRef.current.remove();
      if (notificationResponseRef.current) notificationResponseRef.current.remove();
      wsService.removeListener('notification', handleWebSocketNotification);
    };
  }, [handleWebSocketNotification]);

  useEffect(() => {
    updateBadgeCount(unreadCount + pendingCount);
  }, [unreadCount, pendingCount, updateBadgeCount]);

  const value = {
    notifications,
    unreadCount: unreadCount + pendingCount,
    pendingCount,
    permissionStatus,
    expoPushToken,
    isRealtimeAvailable,
    scheduleLocalNotification,
    triggerNotification,
    cancelNotification,
    cancelAllNotifications,
    refreshNotifications: async () => {
      await fetchNotifications();
      await fetchPendingCount();
    },
    clearNotifications: async () => {
      setNotifications([]);
      setUnreadCount(0);
      setPendingCount(0);
      await updateBadgeCount(0);
      await cancelAllNotifications();
    },
    fetchNotifications,
    fetchPendingCount,
    markAsRead,
    markAllAsRead,
    registerExpoToken: getAndRegisterExpoToken,
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