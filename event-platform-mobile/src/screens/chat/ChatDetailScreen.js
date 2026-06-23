import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import notifee from '@notifee/react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import * as chatApi from '../../api/chat';
import wsService from '../../utils/websocket';
import { setActiveChatId } from '../../utils/navigationService';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors, { borderRadius } from '../../styles/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';

const ChatDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { chatId, chatName, fromNotification } = route.params || {};
  const { user } = useAuth();
  const { decrementChatUnreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  
  console.log('[Chat] ChatDetailScreen rendered');
  console.log('[Chat]   chatId:', chatId);
  console.log('[Chat]   chatName:', chatName);
  console.log('[Chat]   fromNotification:', fromNotification);
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);
  
  const flatListRef = useRef(null);
  const pendingMessages = useRef(new Set());
  const isActiveRef = useRef(true);
  const lastPolledCountRef = useRef(0);
  
  // ========================================
  // Set navigation title from chatName
  // ========================================
  useEffect(() => {
    if (chatName) {
      navigation.setOptions({ title: chatName });
      console.log('[Chat] Set navigation title to:', chatName);
    }
  }, [chatName, navigation]);

  // ========================================
  // Mark chat as read + set active conversation
  // ========================================
  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;

      console.log('[Chat] Screen focused — marking as read and setting active conversation');
      
      // Instantly decrement global unread count for snappy UI
      decrementChatUnreadCount(1);
      
      // Mark messages as read
      chatApi.markChatAsRead(chatId).then((result) => {
        console.log('[Chat] markChatAsRead result:', JSON.stringify(result));
        // Inform other screens that chat has been read
        DeviceEventEmitter.emit('chat_read', chatId);
      }).catch((error) => {
        console.log('[Chat] markChatAsRead error:', error.message);
      });

      // Clear specific notification from status bar
      notifee.cancelNotification(`chat_${chatId}`).then(() => {
        console.log('[Chat] Local notification cleared for chat:', chatId);
      }).catch(err => console.log('[Chat] Failed to clear local notification:', err));

      // Tell the WS service which conversation is active
      // This info is used to suppress duplicate push notifications
      wsService.setActiveConversation(chatId);
      setActiveChatId(chatId);

      return () => {
        console.log('[Chat] Screen unfocused — clearing active conversation');
        wsService.setActiveConversation(null);
        setActiveChatId(null);
      };
    }, [chatId])
  );

  // ========================================
  // Fetch Messages
  // ========================================
  const fetchMessages = async () => {
    if (!chatId) return;
    
    try {
      console.log('[Chat] Fetching messages for chat:', chatId);
      
      // getChatMessages now returns a flat array (pagination unwrapped in chat.js)
      const messageList = await chatApi.getChatMessages(chatId);
      
      // Track existing message IDs to prevent duplicates
      messageList.forEach(msg => {
        if (msg.id) {
          pendingMessages.current.add(msg.id.toString());
        }
      });
      
      console.log('[Chat] Loaded', messageList.length, 'messages');
      setMessages(messageList);
      
      // Scroll to bottom after loading
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
      
    } catch (error) {
      console.error('[Chat] Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // WebSocket Message Handler
  // ========================================
  const handleWebSocketMessage = useCallback((message) => {
    if (!message) {
      console.log('[Chat] WebSocket message handler received null/empty');
      return;
    }
    
    console.log('[Chat] 📩 WebSocket message received:', JSON.stringify(message).slice(0, 200));
    
    const msgId = message.id?.toString();
    
    if (msgId && pendingMessages.current.has(msgId)) {
      console.log('[Chat] Skipping duplicate message:', msgId);
      return;
    }
    
    if (msgId) {
      pendingMessages.current.add(msgId);
    }
    
    setMessages(prev => {
      const exists = prev.some(m => String(m.id) === String(message.id));
      if (exists) {
        console.log('[Chat] Message already in state:', msgId);
        return prev;
      }
      
      console.log('[Chat] ✅ Adding new message to state, id:', msgId);
      return [...prev, message];
    });
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Mark as read since user is actively viewing
    if (chatId) {
      chatApi.markChatAsRead(chatId).catch(() => {});
    }
  }, [chatId]);

  // ========================================
  // WebSocket Error Handler
  // ========================================
  const handleWsError = useCallback((error) => {
    console.log('[Chat] WebSocket error:', error);
    setWsError(error?.message || 'Connection error');
  }, []);

  // ========================================
  // WebSocket Connect
  // ========================================
  const connectWebSocket = useCallback(async () => {
    if (!chatId) return;
    
    setWsError(null);
    
    try {
      console.log('[Chat] Connecting to WebSocket for chat:', chatId);
      await wsService.connect(chatId);
      setWsConnected(true);
      console.log('[Chat] ✅ WebSocket connected successfully');
      
      // Add listener for new messages
      wsService.addListener('new_message', handleWebSocketMessage);
      
      // Add error listener
      wsService.addListener('error', handleWsError);
      
    } catch (error) {
      console.error('[Chat] ❌ WebSocket connection failed:', error);
      setWsConnected(false);
      setWsError(error?.message || 'Failed to connect');
    }
  }, [chatId, handleWebSocketMessage, handleWsError]);

  // ========================================
  // Main Effect
  // ========================================
  useEffect(() => {
    if (!chatId) return;
    
    isActiveRef.current = true;
    
    console.log('[Chat] Effect running for chat:', chatId);
    fetchMessages();
    connectWebSocket();
    
    return () => {
      isActiveRef.current = false;
      console.log('[Chat] Component unmounting for chat:', chatId);
      // Remove our listeners (but don't disconnect the socket)
      wsService.removeListener('new_message', handleWebSocketMessage);
      wsService.removeListener('error', handleWsError);
    };
  }, [chatId]);

  // ========================================
  // Fallback Polling
  // ========================================
  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;
      
      let pollingInterval = null;
      
      const pollMessages = async () => {
        if (!isActiveRef.current) return;
        
        try {
          const messageList = await chatApi.getChatMessages(chatId);
          
          if (messageList.length === lastPolledCountRef.current) return;
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => String(m.id)));
            const newMsgs = messageList.filter(m => !existingIds.has(String(m.id)));
            
            if (newMsgs.length > 0) {
              console.log('[Chat] Polling found', newMsgs.length, 'new messages');
              const combined = [...prev, ...newMsgs].sort((a, b) => {
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return timeA - timeB;
              });
              return combined;
            }
            return prev;
          });
          
          lastPolledCountRef.current = messageList.length;
        } catch (e) {
          console.log('[Chat] Polling error:', e.message);
        }
      };
      
      console.log('[Chat] Fallback polling active (8s interval)');
      pollingInterval = setInterval(pollMessages, 8000);
      setTimeout(pollMessages, 1000);
      
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          console.log('[Chat] Polling stopped');
        }
      };
    }, [chatId])
  );

  // ========================================
  // Send Message
  // ========================================
  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending || !chatId) return;
    
    const messageText = newMessage.trim();
    setSending(true);
    
    // Optimistic UI: add message immediately
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      content: messageText,
      sender_id: user?.id,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    
    // Clear pending message ID after a timeout
    setTimeout(() => {
      pendingMessages.current.delete(tempId);
    }, 5000);
    
    try {
      // Send via REST API (more reliable)
      const savedMessage = await chatApi.sendMessage(chatId, messageText);
      
      // Replace optimistic message with real one
      setMessages(prev => 
        prev.map(m => m.id === tempId ? savedMessage : m)
      );
      
      // Track the real message ID
      if (savedMessage.id) {
        pendingMessages.current.add(savedMessage.id.toString());
      }
      
      console.log('[Chat] ✅ Message sent successfully, id:', savedMessage.id);
       
    } catch (error) {
      console.error('[Chat] ❌ Failed to send message:', error);
      
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      // Restore message text
      setNewMessage(messageText);
    } finally {
      setSending(false);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [newMessage, sending, chatId, user]);

  // ========================================
  // Rendering Helpers
  // ========================================
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const isMyMessage = useCallback((message) => {
    if (!message) return false;
    const senderId = message.sender_id?.toString() || message.sender?.id?.toString();
    return senderId === user?.id?.toString();
  }, [user]);

  const renderMessage = useCallback(({ item, index }) => {
    const isMe = isMyMessage(item);
    const showDate = index === 0 || 
      (messages[index - 1] && formatDate(messages[index - 1]?.created_at) !== formatDate(item.created_at));
    
    return (
      <View>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[
          styles.messageContainer, 
          isMe ? styles.myMessage : styles.theirMessage
        ]}>
          <View style={[
            styles.messageBubble, 
            isMe ? styles.myBubble : styles.theirBubble,
            item.isOptimistic && styles.optimisticBubble
          ]}>
            <Text style={[
              styles.messageText, 
              isMe ? styles.myText : styles.theirText
            ]}>
              {item.content}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime, 
                isMe ? styles.myTime : styles.theirTime
              ]}>
                {formatTime(item.created_at)}
              </Text>
              {isMe && item.isOptimistic && (
                <FontAwesome5 name="clock" size={10} color="rgba(255,255,255,0.7)" style={styles.pendingIndicator} />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [isMyMessage, messages]);

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        {wsConnected ? (
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={styles.statusText}>Connected</Text>
          </View>
        ) : wsError ? (
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.statusText, { color: colors.error }]}>{wsError}</Text>
          </View>
        ) : (
          <View style={styles.connectionStatus}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.statusText}>Connecting...</Text>
          </View>
        )}
      </View>
    </View>
  );

  const canSend = newMessage.trim().length > 0 && !sending;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {renderHeader()}
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item.id?.toString() || `msg_${index}`}
        ListEmptyComponent={
          <EmptyState
            title="No Messages"
            message="Start the conversation!"
          />
        }
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        showsVerticalScrollIndicator={false}
      />
      
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={2000}
          onSubmitEditing={canSend ? handleSend : undefined}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !canSend && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerContent: {
    alignItems: 'center',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messagesList: {
    padding: 12,
    flexGrow: 1,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '75%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
  },
  optimisticBubble: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myText: {
    color: '#fff',
  },
  theirText: {
    color: colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  theirTime: {
    color: colors.textSecondary,
  },
  pendingIndicator: {
    fontSize: 10,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: 'flex-end',
    maxHeight: 120,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: colors.text,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 8,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ChatDetailScreen;