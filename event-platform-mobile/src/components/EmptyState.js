import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../styles/colors';
import Button from './Button';

const EmptyState = ({ 
  title = 'Nothing here yet', 
  message = 'No items to display', 
  icon = '📭',
  actionLabel, 
  onAction,
  variant = 'default',
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'bookings':
        return '📋';
      case 'listings':
        return '🏠';
      case 'notifications':
        return '🔔';
      case 'search':
        return '🔍';
      default:
        return icon;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{getIcon()}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <Button 
          title={actionLabel} 
          onPress={onAction} 
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 280,
  },
  button: {
    minWidth: 160,
  },
});

export default EmptyState;