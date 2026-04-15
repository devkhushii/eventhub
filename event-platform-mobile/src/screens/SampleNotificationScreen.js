/**
 * SampleNotificationScreen.js
 * 
 * Example component demonstrating how to use useNotifications hook
 * to trigger local notifications in Expo Go.
 * 
 * This works WITHOUT:
 * - Development build
 * - EAS builds
 * - Remote push notifications
 * 
 * Simply uses expo-notifications local scheduling which works in Expo Go.
 */

import React from 'react';
import { View, Text, Button, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDate } from '../utils/helpers';

const SampleNotificationScreen = ({ navigation }) => {
  // Use the useNotifications hook to access notification context
  const {
    notifications,
    unreadCount,
    pendingCount,
    permissionStatus,
    triggerNotification,
    scheduleLocalNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  // Example: Trigger immediate notification
  const handleTriggerTestNotification = () => {
    triggerNotification(
      'Test Notification 🎉',
      'This is a test local notification that works in Expo Go!'
    );
  };

  // Example: Trigger notification with data (for navigation)
  const handleTriggerWithData = () => {
    triggerNotification(
      'Booking Confirmed ✅',
      'Your booking has been confirmed. Tap to view details.',
      { type: 'BOOKING', bookingId: '12345' }
    );
  };

  // Example: Schedule notification for 5 seconds later
  const handleScheduleNotification = () => {
    scheduleLocalNotification(
      'Scheduled Reminder ⏰',
      'This notification will appear in 5 seconds!',
      { type: 'REMINDER' },
      5000 // 5000ms = 5 seconds
    );
  };

  // Example: Trigger vendor notification
  const handleVendorNotification = () => {
    triggerNotification(
      'New Booking Request 📋',
      'You have a new booking request from John Doe!'
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications Demo</Text>
        <Text style={styles.subtitle}>
          Status: {permissionStatus === 'granted' ? '✅ Enabled' : '❌ Disabled'}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Local Notifications</Text>
        
        <Button
          title="🔔 Trigger Test Notification"
          onPress={handleTriggerTestNotification}
          style={styles.button}
        />
        
        <Button
          title="📋 Trigger with Data (Booking)"
          onPress={handleTriggerWithData}
          style={styles.button}
        />
        
        <Button
          title="⏰ Schedule (5 second delay)"
          onPress={handleScheduleNotification}
          style={styles.button}
        />
        
        <Button
          title="🏪 Vendor Booking Request"
          onPress={handleVendorNotification}
          style={styles.button}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={markAllAsRead}
        >
          <Text style={styles.actionButtonText}>Mark All as Read</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.dangerButton]}
          onPress={clearNotifications}
        >
          <Text style={styles.actionButtonText}>Clear All Notifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Recent Notifications ({notifications.length})
        </Text>
        
        {notifications.length === 0 ? (
          <Text style={styles.emptyText}>
            No notifications yet. Try triggering one above!
          </Text>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.is_read && styles.unreadCard
              ]}
              onPress={() => markAsRead(notification.id)}
            >
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>
                  {notification.title}
                </Text>
                {!notification.is_read && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>NEW</Text>
                  </View>
                )}
              </View>
              <Text style={styles.notificationBody}>
                {notification.message}
              </Text>
              <Text style={styles.notificationTime}>
                {formatDate(notification.created_at)}
              </Text>
              {notification.is_local && (
                <Text style={styles.localBadge}>📱 Local</Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  button: {
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#6366F1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  notificationCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  unreadCard: {
    backgroundColor: '#e8f4ff',
    borderColor: '#6366F1',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  notificationBody: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  localBadge: {
    fontSize: 10,
    color: '#6366F1',
    marginTop: 4,
  },
});

export default SampleNotificationScreen;