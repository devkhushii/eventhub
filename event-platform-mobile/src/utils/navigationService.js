// src/utils/navigationService.js
// Centralized navigation service using createNavigationContainerRef()
// This is the OFFICIAL way to navigate from outside React components.

import { createNavigationContainerRef } from '@react-navigation/native';

// Create the ref once — this is exported and used by <NavigationContainer ref={navigationRef}>
export const navigationRef = createNavigationContainerRef();

// Queue for navigations attempted before the NavigationContainer is ready
let pendingNavigations = [];

// Track the currently active chat ID to prevent duplicate push notifications
let activeChatId = null;

// Track last navigation to prevent rapid duplicate pushes
let lastNavTimestamp = 0;
let lastNavRoute = null;
let lastNavParams = null;

export const setActiveChatId = (id) => {
  console.log('[NavigationService] Setting activeChatId:', id);
  activeChatId = id;
};

export const getActiveChatId = () => activeChatId;


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
export const navigate = (route, params = {}, retryCount = 0) => {
  console.log(`[NavigationService] navigate() called (retry: ${retryCount})`);
  console.log('[NavigationService]   route:', route);
  console.log('[NavigationService]   params:', JSON.stringify(params));
  console.log('[NavigationService]   isReady:', navigationRef.isReady());

  if (navigationRef.isReady()) {
    // Prevent rapid duplicate navigations (within 500ms)
    const now = Date.now();
    if (
      now - lastNavTimestamp < 500 &&
      lastNavRoute === route &&
      JSON.stringify(lastNavParams) === JSON.stringify(params)
    ) {
      console.log('[NavigationService] 🚫 Ignoring rapid duplicate navigation to:', route);
      return false;
    }

    try {
      navigationRef.navigate(route, params);
      console.log('[NavigationService] ✅ Navigation SUCCESS to', route);
      
      lastNavTimestamp = now;
      lastNavRoute = route;
      lastNavParams = params;
      
      return true;
    } catch (error) {
      console.log('[NavigationService] ❌ Navigation ERROR:', error.message);
      
      // If navigation fails because the route isn't available yet (e.g. still in AuthNavigator),
      // we retry up to 3 times with a 500ms delay.
      if (retryCount < 3) {
        console.log(`[NavigationService] ⏳ Retrying navigation to ${route} in 500ms...`);
        setTimeout(() => {
          navigate(route, params, retryCount + 1);
        }, 500);
      } else {
        console.log(`[NavigationService] 🚫 Max retries reached for ${route}. Pushing back to queue.`);
        // Re-add to queue if max retries hit so it can be flushed on next state change
        const isDuplicate = pendingNavigations.some(
          nav => nav.route === route && JSON.stringify(nav.params) === JSON.stringify(params)
        );
        if (!isDuplicate) {
          pendingNavigations.push({ route, params });
        }
      }
      return false;
    }
  } else {
    console.log('[NavigationService] ⏳ Navigation NOT ready, queuing:', route);
    // Deduplicate: avoid pushing same chat screen multiple times
    const isDuplicate = pendingNavigations.some(
      nav => nav.route === route && JSON.stringify(nav.params) === JSON.stringify(params)
    );
    if (!isDuplicate) {
      pendingNavigations.push({ route, params });
    } else {
      console.log('[NavigationService] 🚫 Ignoring duplicate pending navigation');
    }
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
  setActiveChatId,
  getActiveChatId,
};