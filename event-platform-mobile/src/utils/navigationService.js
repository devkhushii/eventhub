// src/utils/navigationService.js
// Centralized navigation service using createNavigationContainerRef()
// This is the OFFICIAL way to navigate from outside React components.

import { createNavigationContainerRef } from '@react-navigation/native';

// Create the ref once — this is exported and used by <NavigationContainer ref={navigationRef}>
export const navigationRef = createNavigationContainerRef();

// Queue for navigations attempted before the NavigationContainer is ready
let pendingNavigations = [];

/**
 * Check if NavigationContainer is mounted and ready.
 */
export const isNavigationReady = () => {
  const ready = navigationRef.isReady();
  console.log('[NavigationService] isNavigationReady:', ready);
  return ready;
};

/**
 * Called by NavigationContainer's onReady callback.
 * Flushes any queued navigations.
 */
export const onNavigationReady = () => {
  console.log('[NavigationService] ✅ NavigationContainer is READY');
  console.log('[NavigationService] Pending navigations queue:', pendingNavigations.length);

  // Process queued navigations
  const queue = [...pendingNavigations];
  pendingNavigations = [];

  queue.forEach(({ route, params }) => {
    console.log('[NavigationService] Flushing pending navigation:', route, JSON.stringify(params));
    navigate(route, params);
  });
};

/**
 * Navigate to a screen. If navigation is not ready, queue it.
 */
export const navigate = (route, params = {}) => {
  console.log('[NavigationService] navigate() called');
  console.log('[NavigationService]   route:', route);
  console.log('[NavigationService]   params:', JSON.stringify(params));
  console.log('[NavigationService]   isReady:', navigationRef.isReady());

  if (navigationRef.isReady()) {
    try {
      navigationRef.navigate(route, params);
      console.log('[NavigationService] ✅ Navigation SUCCESS to', route);
      return true;
    } catch (error) {
      console.log('[NavigationService] ❌ Navigation ERROR:', error.message);
      return false;
    }
  } else {
    console.log('[NavigationService] ⏳ Navigation NOT ready, queuing:', route);
    pendingNavigations.push({ route, params });
    return false;
  }
};

/**
 * Navigate to a chat screen from a notification tap.
 * This is the primary entry point for notification-driven navigation.
 */
export const openChat = (chatId, chatName = 'Chat') => {
  console.log('[NavigationService] 🔔 openChat() called');
  console.log('[NavigationService]   chatId:', chatId);
  console.log('[NavigationService]   chatName:', chatName);

  if (!chatId) {
    console.log('[NavigationService] ❌ openChat called with no chatId');
    return false;
  }

  return navigate('ChatDetail', {
    chatId,
    chatName,
    fromNotification: true,
  });
};

/**
 * Go back to previous screen.
 */
export const goBack = () => {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
};

/**
 * Reset to home/main tabs.
 */
export const resetToHome = () => {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  }
};

export default {
  navigationRef,
  isNavigationReady,
  onNavigationReady,
  navigate,
  openChat,
  goBack,
  resetToHome,
};