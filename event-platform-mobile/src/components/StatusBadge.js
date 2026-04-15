import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../styles/colors';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    backgroundColor: colors.warningLight,
    textColor: colors.warning,
    icon: '⏳',
  },
  APPROVED: {
    label: 'Approved',
    backgroundColor: colors.infoLight,
    textColor: colors.info,
    icon: '📋',
  },
  AWAITING_ADVANCE: {
    label: 'Awaiting Advance',
    backgroundColor: colors.warningLight,
    textColor: colors.warning,
    icon: '💳',
  },
  CONFIRMED: {
    label: 'Confirmed',
    backgroundColor: colors.successLight,
    textColor: colors.success,
    icon: '✅',
  },
  AWAITING_FINAL_PAYMENT: {
    label: 'Awaiting Final',
    backgroundColor: colors.warningLight,
    textColor: colors.warning,
    icon: '💰',
  },
  COMPLETED: {
    label: 'Completed',
    backgroundColor: colors.primaryLight + '30',
    textColor: colors.primary,
    icon: '🎉',
  },
  CANCELLED: {
    label: 'Cancelled',
    backgroundColor: colors.surfaceLight,
    textColor: colors.textMuted,
    icon: '🚫',
  },
  REJECTED: {
    label: 'Rejected',
    backgroundColor: colors.errorLight,
    textColor: colors.error,
    icon: '❌',
  },
};

const StatusBadge = ({ status, size = 'medium', showIcon = true }) => {
  if (!status) {
    return null;
  }

  const statusUpper = status.toUpperCase();
  const config = STATUS_CONFIG[statusUpper] || {
    label: status,
    backgroundColor: colors.surfaceLight,
    textColor: colors.textMuted,
    icon: '•',
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 4, paddingHorizontal: 8, fontSize: 10 };
      case 'large':
        return { paddingVertical: 8, paddingHorizontal: 14, fontSize: 14 };
      default:
        return { paddingVertical: 6, paddingHorizontal: 12, fontSize: 12 };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
      ]}
    >
      {showIcon && <Text style={styles.icon}>{config.icon}</Text>}
      <Text
        style={[
          styles.text,
          { color: config.textColor, fontSize: sizeStyles.fontSize },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 10,
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

export default StatusBadge;