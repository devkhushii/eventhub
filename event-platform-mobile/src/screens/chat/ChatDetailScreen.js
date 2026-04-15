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
} from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import * as chatApi from '../../api/chat';
import wsService from '../../utils/websocket';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors, { borderRadius } from '../../styles/colors';
import { useAuth } from '../../contexts/AuthContext';

const ChatDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { chatId, chatName } = route.params || {};
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);
  
  const flatListRef = useRef(null);
  const pendingMessages = useRef(new Set());
  
  const fetchMessages = async () => {
    if (!chatId) return;
    
    try {
      console.log('[Chat] Fetching messages for chat:', chatId);
      
      // Call the API - handle both array and object response
      const data = await chatApi.getChatMessages(chatId);
      
      let messageList = [];
      if (Array.isArray(data)) {
        messageList = data;
      } else if (data && Array.isArray(data.data)) {
        messageList = data.data;
      }
      
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

  const handleWebSocketMessage = useCallback((message) => {
    if (!message) return;
    
    const msgId = message.id?.toString();
    
    // Skip if we already have this message
    if (msgId && pendingMessages.current.has(msgId)) {
      console.log('[Chat] Skipping duplicate message:', msgId);
      return;
    }
    
    // Add to known messages
    if (msgId) {
      pendingMessages.current.add(msgId);
    }
    
    setMessages(prev => {
      // Check if message already exists
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;
      
      console.log('[Chat] New message added via WebSocket');
      return [...prev, message];
    });
    
    // Scroll to latest message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const connectWebSocket = useCallback(async () => {
    if (!chatId) return;
    
    setWsError(null);
    
    try {
      console.log('[Chat] Connecting to WebSocket...');
      await wsService.connect(chatId);
      setWsConnected(true);
      console.log('[Chat] WebSocket connected');
      
      // Add listener for new messages
      wsService.addListener('new_message', handleWebSocketMessage);
      
      // Add error listener
      wsService.addListener('error', (error) => {
        console.log('[Chat] WebSocket error:', error);
        setWsError(error?.message || 'Connection error');
      });
      
    } catch (error) {
      console.error('[Chat] WebSocket connection failed:', error);
      setWsConnected(false);
      setWsError(error?.message || 'Failed to connect');
    }
  }, [chatId, handleWebSocketMessage]);

  useEffect(() => {
    if (!chatId) return;
    
    fetchMessages();
    connectWebSocket();
    
    return () => {
      console.log('[Chat] Cleaning up WebSocket connection');
      wsService.removeListener('new_message', handleWebSocketMessage);
      wsService.disconnect();
    };
  }, [chatId]);

  // Fallback polling - always runs to ensure receiver gets messages
  useFocusEffect(
    useCallback(() => {
      if (!chatId) return;
      
      let pollingInterval;
      
      const pollMessages = async () => {
        try {
          const data = await chatApi.getChatMessages(chatId);
          let messageList = [];
          if (Array.isArray(data)) {
            messageList = data;
          } else if (data && Array.isArray(data.data)) {
            messageList = data.data;
          }
          
          // Merge with existing messages, avoiding duplicates
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = messageList.filter(m => !existingIds.has(m.id));
            if (newMsgs.length > 0) {
              console.log('[Chat] Polling found', newMsgs.length, 'new messages');
              return [...prev, ...newMsgs];
            }
            return prev;
          });
        } catch (e) {
          console.log('[Chat] Polling error:', e.message);
        }
      };
      
      // Always start polling as reliable fallback
      console.log('[Chat] Starting fallback polling');
      pollMessages(); // Initial fetch
      pollingInterval = setInterval(pollMessages, 4000); // Then every 4 seconds
      
      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          console.log('[Chat] Stopped polling');
        }
      };
    }, [chatId])
  );

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
      
console.log('[Chat] Message sent successfully');
       
    } catch (error) {
      console.error('[Chat] Failed to send message:', error);
      
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      // Show error to user
      setNewMessage(messageText); // Restore message text
    } finally {
      setSending(false);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [newMessage, sending, chatId, user]);

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
                <Text style={styles.pendingIndicator}> ⏳</Text>
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
      
      <View style={styles.inputContainer}>
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