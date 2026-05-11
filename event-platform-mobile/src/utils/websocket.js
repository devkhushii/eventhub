import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, WS_BASE_URL, getWebSocketUrl } from '../utils/constants';

console.log('[WebSocket] 🎯 Using WebSocket base URL:', WS_BASE_URL);

class WebSocketService {
  constructor() {
    this.ws = null;
    this.notificationWs = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.reconnectTimer = null;       // BUG FIX: track reconnect timer
    this.currentChatId = null;
    this.isConnecting = false;
    this.messageIds = new Set();
    this.appState = 'unknown';
    this.activeConversationId = null;
  }

  setAppState(state) {
    this.appState = state;
    console.log('[WebSocket] App state changed to:', state);
  }

  setActiveConversation(conversationId) {
    this.activeConversationId = conversationId;
    console.log('[WebSocket] Active conversation set to:', conversationId);
  }

  getPresenceInfo() {
    return {
      isConnected: this.isConnected(),
      appState: this.appState,
      activeConversationId: this.activeConversationId,
      currentChatId: this.currentChatId,
    };
  }

  async getToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('[WebSocket] Failed to get token:', error);
      return null;
    }
  }

  async connectNotifications() {
    try {
      const token = await this.getToken();
      if (!token) {
        console.log('[WebSocket] No token for notifications');
        return;
      }

      if (this.notificationWs && this.notificationWs.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] Already connected to notifications');
        return;
      }

      const wsUrl = getWebSocketUrl('/ws/notifications', `token=${token}`);
      console.log('[WebSocket] Connecting to notifications:', wsUrl.replace(token, '***'));

      this.notificationWs = new WebSocket(wsUrl);

      this.notificationWs.onopen = () => {
        console.log('[WebSocket] Connected to notifications');
      };

      this.notificationWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Notification received:', data);

          if (data.type === 'notification' && data.data) {
            this.notifyListeners('notification', data.data);
          }
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      this.notificationWs.onerror = (error) => {
        console.error('[WebSocket] Notification error:', error);
      };

      this.notificationWs.onclose = (event) => {
        console.log('[WebSocket] Notification disconnected:', event.code);
        this.notificationWs = null;
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect to notifications:', error);
    }
  }

  disconnectNotifications() {
    if (this.notificationWs) {
      this.notificationWs.close(1000, 'User disconnected');
      this.notificationWs = null;
      console.log('[WebSocket] Disconnected from notifications');
    }
  }

  async connect(chatId) {
    console.log('[WebSocket] connect() called for chatId:', chatId, 'currentChatId:', this.currentChatId);
    
    if (this.isConnecting) {
      console.log('[WebSocket] Already connecting, waiting...');
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval);
            if (this.currentChatId === chatId && this.ws?.readyState === WebSocket.OPEN) {
              resolve();
            } else {
              this.connect(chatId).then(resolve);
            }
          }
        }, 100);
      });
    }

    // Already connected to the same chat - great!
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentChatId === chatId) {
      console.log('[WebSocket] Already connected to this chat');
      return Promise.resolve();
    }

    this.isConnecting = true;
    const previousChatId = this.currentChatId;
    this.currentChatId = chatId;

    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      // Close existing connection if switching chats (but gracefully)
      if (this.ws && this.ws.readyState === WebSocket.OPEN && previousChatId !== chatId) {
        console.log('[WebSocket] Switching from chat', previousChatId, 'to', chatId);
        this.ws.close(1000, 'Switching chats');
        this.ws = null;
        // Wait a moment for clean disconnect
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const wsUrl = getWebSocketUrl(`/ws/chat/${chatId}`, `token=${token}`);
      console.log('[WebSocket] Connecting to:', wsUrl.replace(token, '***'));

      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[WebSocket] Connected successfully');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WebSocket] Received raw:', JSON.stringify(data).slice(0, 500));

            // Handle new_message type - support both payload.message and direct payload
            if (data.type === 'new_message') {
              // Handle the payload structure: { type: 'new_message', conversation_id: '...', message: { ... } }
              const msg = data.message || data;
              
              console.log('[WebSocket] Processing message:', JSON.stringify(msg).slice(0, 200));
              
              // Create a normalized message ID
              const msgId = msg?.id?.toString();
              
              if (msgId && this.messageIds.has(msgId)) {
                console.log('[WebSocket] Duplicate message detected, skipping:', msgId);
                this.notifyListeners('duplicate', msg);
                return;
              }
              
              if (msgId) {
                this.messageIds.add(msgId);
                console.log('[WebSocket] Added message ID to tracking:', msgId);
              }
              
              // Clean up old message IDs to prevent memory leak
              if (this.messageIds.size > 100) {
                const arr = Array.from(this.messageIds);
                this.messageIds = new Set(arr.slice(-100));
                console.log('[WebSocket] Cleaned up old message IDs, kept:', this.messageIds.size);
              }
              
              // Notify listeners with the actual message
              console.log('[WebSocket] Notifying listeners with message, id:', msgId);
              this.notifyListeners('new_message', msg);
            } else if (data.type === 'pong') {
              console.log('[WebSocket] Pong received');
            } else if (data.error) {
              console.error('[WebSocket] Error from server:', data.error);
              this.notifyListeners('error', data);
            } else {
              console.log('[WebSocket] Unknown message type:', data.type);
              this.notifyListeners('raw', data);
            }
          } catch (error) {
            console.error('[WebSocket] Parse error:', error);
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[WebSocket] Error:', error);
          this.isConnecting = false;
          this.notifyListeners('error', error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('[WebSocket] Disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.cleanup();
          
          if (event.code !== 1000 && this.currentChatId) {
            console.log('[WebSocket] Scheduling auto-reconnect...');
            this.handleReconnect(this.currentChatId);
          }
        };
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('[WebSocket] Connection error:', error);
      if (chatId) {
        this.handleReconnect(chatId);
      }
      throw error;
    }
  }

  handleReconnect(chatId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`[WSReconnect] Reconnecting... Attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      // BUG FIX: store the timer so disconnect() can cancel it
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect(chatId).catch((error) => {
          console.error('[WSReconnect] Reconnect failed:', error.message);
        });
      }, delay);
    } else {
      console.error('[WSReconnect] Max reconnect attempts reached');
      this.notifyListeners('error', { message: 'Connection lost. Please restart the app.' });
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify(data);
      this.ws.send(message);
      console.log('[WebSocket] Sent:', data);
      return true;
    } else {
      console.warn('[WebSocket] Not connected, cannot send');
      return false;
    }
  }

  sendChatMessage(content) {
    return this.send({
      type: 'chat_message',
      content: content,
    });
  }

  sendPing() {
    return this.send({
      type: 'ping',
      timestamp: Date.now(),
    });
  }

  disconnect() {
    console.log('[AuthCleanup] WebSocket disconnect() called');
    
    // BUG FIX: cancel any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      console.log('[AuthCleanup] Cleared pending reconnect timer');
    }
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.currentChatId = null;
    this.activeConversationId = null;  // BUG FIX: clear active conversation
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.messageIds.clear();
    console.log('[AuthCleanup] WebSocket fully disconnected and state cleared');
  }

  cleanup() {
    const maxIds = 200;
    if (this.messageIds.size > maxIds) {
      const arr = Array.from(this.messageIds);
      this.messageIds = new Set(arr.slice(-maxIds));
      console.log('[WebSocket] Cleaned up message IDs');
    }
  }

  clearMessageIds() {
    this.messageIds.clear();
    console.log('[WebSocket] Cleared all message IDs');
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const callbacks = this.listeners.get(event);
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
      console.log('[WebSocket] Listener added for:', event);
    }
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WebSocket] Listener error:', error);
        }
      });
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionState() {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;