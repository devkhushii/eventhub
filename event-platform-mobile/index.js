import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';

import { openChat } from './src/utils/navigationService';

// Handle background events for Notifee
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && detail.notification) {
    console.log('[Notifee] Background notification pressed:', detail.notification.id);
    const data = detail.notification.data || {};
    const notificationType = data.type;
    const chatId = data.chat_id || data.reference_id;
    const chatName = data.chat_name || detail.notification.title?.replace('New message from ', '') || 'Chat';

    if ((notificationType === 'MESSAGE' || notificationType === 'CHAT') && chatId) {
      console.log('[Notifee] Queueing openChat from background tap...');
      // Navigation container may not be mounted yet, but openChat queues it safely
      openChat(chatId, chatName);
    }
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
