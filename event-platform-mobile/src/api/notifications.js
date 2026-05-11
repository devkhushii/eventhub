import apiClient from '../utils/apiClient';
import { Platform } from 'react-native';

export const registerExpoToken = async (expoPushToken) => {
  console.log('[Notifications API] Registering Expo token...');
  const response = await apiClient.post('/notifications/register-token', {
    expo_push_token: expoPushToken,
  });
  return response.data;
};

export const registerDeviceToken = async (token, deviceId = null) => {
  console.log('[Notifications API] Registering FCM device token...');
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  const response = await apiClient.post('/notifications/device-token', {
    token,
    platform,
    device_id: deviceId,
  });
  return response.data;
};

export const unregisterDeviceToken = async (token) => {
  console.log('[Notifications API] Unregistering device token...');
  const response = await apiClient.delete('/notifications/device-token', {
    params: { token },
  });
  return response.data;
};

export const refreshDeviceToken = async (oldToken, newToken) => {
  console.log('[Notifications API] Refreshing device token...');
  const response = await apiClient.put('/notifications/device-token/refresh', null, {
    params: { old_token: oldToken, new_token: newToken },
  });
  return response.data;
};

export const getNotifications = async (params = {}) => {
  console.log('[Notifications API] Getting notifications...');
  const response = await apiClient.get('/notifications', { params });
  return response.data;
};

export const getUnreadCount = async () => {
  console.log('[Notifications API] Getting unread count...');
  const response = await apiClient.get('/notifications/unread-count');
  return response.data;
};

export const markAsRead = async (notificationId) => {
  if (!notificationId) {
    throw new Error('Notification ID is required');
  }
  console.log('[Notifications API] Marking as read:', notificationId);
  const response = await apiClient.patch(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllAsRead = async () => {
  console.log('[Notifications API] Marking all as read...');
  const response = await apiClient.patch('/notifications/read-all');
  return response.data;
};

export const deleteNotification = async (notificationId) => {
  if (!notificationId) {
    throw new Error('Notification ID is required');
  }
  console.log('[Notifications API] Deleting notification:', notificationId);
  const response = await apiClient.delete(`/notifications/${notificationId}`);
  return response.data;
};

export default {
  registerExpoToken,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};