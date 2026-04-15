import apiClient from '../utils/apiClient';

export const registerExpoToken = async (expoPushToken) => {
  console.log('[Notifications API] Registering Expo token...');
  const response = await apiClient.post('/notifications/register-token', {
    expo_push_token: expoPushToken,
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