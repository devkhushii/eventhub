import { useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as notificationService from '../services/notificationService';

export const useNotifications = () => {
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);
  const notificationHandlersRef = useRef(null);

  const handleNotificationReceived = useCallback((notification) => {
    console.log('[useNotifications] Foreground notification:', notification?.request?.content);
    
    // Extract data from notification
    const data = notification?.request?.content?.data || {};
    const notificationType = data.type || notification?.request?.content?.title;
    
    console.log('[useNotifications] Notification type:', notificationType);
    
    // Could show in-app toast here
    // For now just log it
  }, []);

  const handleNotificationResponse = useCallback((response) => {
    console.log('[useNotifications] Notification tapped:', response);
    
    // Extract notification data
    const notification = response?.notification;
    const data = notification?.request?.content?.data || {};
    
    const type = data.type;
    const referenceId = data.reference_id || data.referenceId;
    
    console.log('[useNotifications] Navigating based on:', { type, referenceId });
    
    // Navigate based on notification type
    switch (type) {
      case 'MESSAGE':
      case 'message':
        if (referenceId) {
          // Navigate to chat
          navigation.navigate('MainTabs', {
            screen: 'Chats',
            params: {
              screen: 'ChatDetail',
              params: { chatId: referenceId },
            },
          });
        }
        break;
        
      case 'BOOKING':
      case 'booking':
        if (referenceId) {
          // Navigate to booking details
          navigation.navigate('MainTabs', {
            screen: 'Bookings',
            params: {
              screen: 'BookingDetail',
              params: { bookingId: referenceId },
            },
          });
        }
        break;
        
      case 'PAYMENT':
      case 'payment':
        if (referenceId) {
          // Navigate to booking details (payment related)
          navigation.navigate('MainTabs', {
            screen: 'Bookings',
            params: {
              screen: 'BookingDetail',
              params: { bookingId: referenceId },
            },
          });
        }
        break;
        
      default:
        // Default to notifications screen
        navigation.navigate('MainTabs', { screen: 'Notifications' });
        break;
    }
  }, [navigation]);

  // Initialize notifications
  const initializeNotifications = useCallback(async () => {
    console.log('[useNotifications] Initializing...');
    
    // 1. Get push token
    const token = await notificationService.requestNotificationPermissions();
    
    if (token) {
      console.log('[useNotifications] Got token, registering...');
      await notificationService.registerDeviceToken(token);
    }
    
    // 2. Setup handlers
    const cleanup = notificationService.setupNotificationHandlers(
      handleNotificationReceived,
      handleNotificationResponse
    );
    
    notificationHandlersRef.current = cleanup;
    
    console.log('[useNotifications] Initialized successfully');
    
    return cleanup;
  }, [handleNotificationReceived, handleNotificationResponse]);

  // Handle app state changes for background/foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('[useNotifications] App state changed:', appState.current, '->', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - reinitialize notifications
        console.log('[useNotifications] App came to foreground');
        
        // Reset badge count
        await notificationService.updateBadgeCount(0);
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    initializeNotifications,
  };
};

export default useNotifications;