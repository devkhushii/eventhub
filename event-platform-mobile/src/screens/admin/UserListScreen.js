import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as usersApi from '../../api/users';
import * as adminApi from '../../api/admin';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';

const UserListScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await usersApi.getUsers(0, 100);
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.is_active ? 'inactive' : 'active';
    Alert.alert(
      'Update Status',
      `Make user ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await adminApi.updateUserStatus(user.id, { is_active: newStatus === 'active' });
              fetchUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update user status');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (user) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.deleteUser(user.id);
              fetchUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }) => (
    <Card style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.userMeta}>
          <Text style={styles.roleText}>Role: {item.role || 'user'}</Text>
          <Text style={[styles.statusText, item.is_active ? styles.active : styles.inactive]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleStatus(item)}
        >
          <Text style={styles.actionText}>
            {item.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(item)}
        >
          <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <EmptyState
            title="No Users"
            message="No users found"
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
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 12,
    color: colors.textMuted,
    marginRight: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  active: {
    color: colors.success,
  },
  inactive: {
    color: colors.error,
  },
  userActions: {
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    marginBottom: 4,
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: colors.error + '20',
  },
  deleteText: {
    color: colors.error,
  },
});

export default UserListScreen;
