import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, shadows, borderRadius } from '../styles/colors';

const NotificationBell = ({ count = 0, onPress, size = 'medium' }) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return 36;
      case 'large':
        return 52;
      default:
        return 44;
    }
  };

  const iconSize = size === 'small' ? 18 : size === 'large' ? 26 : 22;
  const dimension = getSize();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
        },
        shadows.small,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={{ fontSize: iconSize }}>🔔</Text>
      {count > 0 && (
        <View
          style={[
            styles.badge,
            count > 99 && styles.badgeLarge,
          ]}
        >
          <Text style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeLarge: {
    minWidth: 28,
  },
  badgeText: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: '700',
  },
});

export default NotificationBell;