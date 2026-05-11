import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import { openChat } from './src/utils/navigationService';

export default function App() {
  useEffect(() => {
    // Handle deep links (e.g. celebrato://chat/123)
    const handleDeepLink = (event) => {
      const url = event.url;
      console.log('[App] Deep link received:', url);
      
      if (url && url.includes('chat/')) {
        const chatId = url.split('chat/')[1]?.split('?')[0];
        if (chatId) {
          console.log('[App] Deep link to chat:', chatId);
          openChat(chatId, 'Chat');
        }
      }
    };

    // Check for initial deep link URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[App] Initial deep link URL:', url);
        handleDeepLink({ url });
      } else {
        console.log('[App] No initial deep link URL');
      }
    });

    // Listen for subsequent deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <NotificationProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </NotificationProvider>
    </AuthProvider>
  );
}