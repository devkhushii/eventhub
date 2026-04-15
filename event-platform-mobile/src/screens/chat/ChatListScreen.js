import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as chatApi from '../../api/chat';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { getInitials } from '../../utils/helpers';

const ChatListScreen = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = async () => {
    try {
      const data = await chatApi.getChats();
      setChats(data);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  const getParticipantName = (chat) => {
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

  const renderChat = ({ item }) => {
    const participantName = getParticipantName(item);
    return (
      <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(participantName)}</Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>{participantName}</Text>
            <Text style={styles.chatTime}>{formatTime(item.last_message?.created_at)}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.last_message?.content || 'No messages yet'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread_count}</Text>
            </View>
          )}
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
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  chatTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ChatListScreen;