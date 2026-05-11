import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as chatApi from '../../api/chat';
import { useAuth } from '../../contexts/AuthContext';
import wsService from '../../utils/websocket';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { getInitials } from '../../utils/helpers';

const ChatListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const isMountedRef = useRef(true);
  const wsListenerRef = useRef(null);  // BUG FIX: track WS listener for proper cleanup

  const isVendor = user?.role?.toUpperCase() === 'VENDOR';

  // ========================================
  // Fetch & Merge Chats
  // ========================================
  const fetchChats = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      console.log('[ChatList] Fetching chats... isVendor:', isVendor, 'userId:', user?.id);

      let allChats = [];

      // Always fetch user chats
      try {
        const userChats = await chatApi.getChats();
        console.log('[ChatList] User chats fetched:', userChats.length);
        allChats = [...userChats];
      } catch (error) {
        console.log('[ChatList] User chats fetch error:', error.response?.status || error.message);
        // Don't fail — continue to vendor chats
      }

      // If user is a vendor, also fetch vendor chats
      if (isVendor) {
        try {
          const vendorChats = await chatApi.getVendorChats();
          console.log('[ChatList] Vendor chats fetched:', vendorChats.length);
          allChats = [...allChats, ...vendorChats];
        } catch (error) {
          // 403 is expected if vendor profile not fully set up — not a bug
          console.log('[ChatList] Vendor chats fetch error:', error.response?.status || error.message);
        }
      }

      // Deduplicate by chat.id
      const chatMap = new Map();
      allChats.forEach(chat => {
        const id = chat.id?.toString();
        if (id && !chatMap.has(id)) {
          chatMap.set(id, chat);
        }
      });
      let uniqueChats = Array.from(chatMap.values());

      // Sort by last_message.created_at descending (most recent first)
      uniqueChats = sortChatsByLatest(uniqueChats);

      console.log('[ChatList] Final merged/sorted chat count:', uniqueChats.length);

      if (isMountedRef.current) {
        setChats(uniqueChats);
      }
    } catch (error) {
      console.error('[ChatList] Failed to fetch chats:', error);
    } finally {
      // BUG FIX: Always set loading=false even if errors occur
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isVendor, user?.id]);

  const sortChatsByLatest = (chatList) => {
    return [...chatList].sort((a, b) => {
      const timeA = getLastMessageTimestamp(a);
      const timeB = getLastMessageTimestamp(b);
      return timeB - timeA;
    });
  };

  const getLastMessageTimestamp = (chat) => {
    if (chat.last_message && typeof chat.last_message === 'object' && chat.last_message.created_at) {
      return new Date(chat.last_message.created_at).getTime();
    }
    if (chat.updated_at) {
      return new Date(chat.updated_at).getTime();
    }
    if (chat.created_at) {
      return new Date(chat.created_at).getTime();
    }
    return 0;
  };

  // ========================================
  // Focus Effect — refresh when screen gains focus
  // ========================================
  useFocusEffect(
    useCallback(() => {
      console.log('[ChatList] Screen focused — fetching chats');
      fetchChats();
    }, [fetchChats])
  );

  // ========================================
  // Mount / Unmount tracking
  // ========================================
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ========================================
  // AppState Effect — refresh when app comes to foreground
  // ========================================
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[ChatList] App foregrounded — refreshing chats');
        fetchChats();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [fetchChats]);

  // ========================================
  // WebSocket listener — realtime chat list updates
  // BUG FIX: Use a ref-tracked named function so it can be properly removed
  // ========================================
  useEffect(() => {
    // Create a named handler we can track and remove
    const handleNotificationForChatList = (data) => {
      console.log('[ChatList] 📩 Notification WS event received');
      console.log('[ChatList] Event type:', data?.type, '| title:', data?.title);
      // Any notification event = re-fetch to get updated last_message + unread_count
      fetchChats();
    };

    wsListenerRef.current = handleNotificationForChatList;
    wsService.addListener('notification', handleNotificationForChatList);
    console.log('[ChatList] WebSocket notification listener registered');

    return () => {
      // BUG FIX: properly remove the exact same function reference
      if (wsListenerRef.current) {
        wsService.removeListener('notification', wsListenerRef.current);
        wsListenerRef.current = null;
        console.log('[ChatList] WebSocket notification listener removed');
      }
    };
  }, [fetchChats]);

  // ========================================
  // Pull-to-refresh
  // ========================================
  const handleRefresh = () => {
    console.log('[ChatList] Pull-to-refresh triggered');
    setRefreshing(true);
    fetchChats();
  };

  // ========================================
  // Helpers
  // ========================================
  const getParticipantName = (chat) => {
    if (user?.id?.toString() === chat.user_id?.toString()) {
      if (chat.vendor?.business_name) return chat.vendor.business_name;
    } else {
      if (chat.user?.full_name) return chat.user.full_name;
    }
    if (chat.participant?.name) return chat.participant.name;
    if (chat.vendor?.business_name) return chat.vendor.business_name;
    if (chat.vendor?.full_name) return chat.vendor.full_name;
    if (chat.user?.full_name) return chat.user.full_name;
    if (chat.participant?.full_name) return chat.participant.full_name;
    return 'Chat';
  };

  const handleChatPress = (chat) => {
    const name = getParticipantName(chat);
    console.log('[ChatList] Opening chat:', chat.id, 'with:', name);
    navigation.navigate('ChatDetail', { chatId: chat.id, chatName: name });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getLastMessage = (chat) => {
    if (chat.last_message && typeof chat.last_message === 'object') {
      return chat.last_message.content;
    }
    if (chat.last_message_text) {
      return chat.last_message_text;
    }
    if (typeof chat.last_message === 'string') {
      return chat.last_message;
    }
    return null;
  };

  const getLastMessageTime = (chat) => {
    if (chat.last_message && typeof chat.last_message === 'object') {
      return chat.last_message.created_at;
    }
    return chat.updated_at || null;
  };

  const getUnreadCount = (chat) => {
    return chat.unread_count || 0;
  };

  // ========================================
  // Render
  // ========================================
  const renderChat = ({ item }) => {
    const participantName = getParticipantName(item);
    const lastMessage = getLastMessage(item);
    const lastMessageTime = getLastMessageTime(item);
    const unreadCount = getUnreadCount(item);

    return (
      <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(participantName)}</Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, unreadCount > 0 && styles.chatNameUnread]} numberOfLines={1}>
              {participantName}
            </Text>
            <Text style={[styles.chatTime, unreadCount > 0 && styles.chatTimeUnread]}>
              {formatTime(lastMessageTime)}
            </Text>
          </View>
          <View style={styles.chatFooter}>
            <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
              {lastMessage || 'No messages yet'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>
      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <EmptyState
            title="No Chats"
            message="Start a conversation with a vendor."
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  chatTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  chatTimeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  lastMessageUnread: {
    color: colors.text,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ChatListScreen;