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
    this.currentChatId = null;
    this.isConnecting = false;
    this.messageIds = new Set();
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
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentChatId === chatId)) {
      console.log('[WebSocket] Already connected or connecting');
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.currentChatId = chatId;

    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      // Use dynamic WebSocket URL
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
            console.log('[WebSocket] Received:', data);
            
            // Handle different message types
            if (data.type === 'new_message' && data.message) {
              const msg = data.message;
              
              // Prevent duplicate messages using message ID
              if (msg.id && this.messageIds.has(msg.id)) {
                console.log('[WebSocket] Duplicate message, skipping:', msg.id);
                return;
              }
              
              if (msg.id) {
                this.messageIds.add(msg.id);
              }
              
              // Clean up old message IDs (keep last 100)
              if (this.messageIds.size > 100) {
                const arr = Array.from(this.messageIds);
                this.messageIds = new Set(arr.slice(-100));
              }
              
              this.notifyListeners('new_message', msg);
            } else if (data.type === 'pong') {
              console.log('[WebSocket] Pong received');
            } else if (data.error) {
              console.error('[WebSocket] Error from server:', data.error);
              this.notifyListeners('error', data);
            } else {
              // Broadcast all other messages to all listeners
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
          reject(error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log('[WebSocket] Disconnected:', event.code, event.reason);
          this.isConnecting = false;
          
          // Don't auto-reconnect - let the app handle reconnection via polling or user action
          // Only log the disconnect for debugging
          if (event.code !== 1000) {
            console.log('[WebSocket] Abnormal close, wsService will handle via polling');
          }
        };
      });
    } catch (error) {
      this.isConnecting = false;
      console.error('[WebSocket] Connection error:', error);
      throw error;
    }
  }

  handleReconnect(chatId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      console.log(`[WebSocket] Reconnecting... Attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect(chatId).catch((error) => {
          console.error('[WebSocket] Reconnect failed:', error);
        });
      }, delay);
    } else {
      console.error('[WebSocket] Max reconnect attempts reached');
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
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.currentChatId = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.messageIds.clear();
    console.log('[WebSocket] Disconnected (socket closed, listeners preserved)');
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const callbacks = this.listeners.get(event);
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
      console.log('[WebSocket] Listener added for:', event);
    } else {
      console.log('[WebSocket] Listener already exists for:', event);
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